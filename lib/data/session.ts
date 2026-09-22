import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Group, Profile, Role } from "@/lib/supabase/database.types";

/**
 * The Data Access Layer.
 *
 * Per the Next auth guide, `proxy.ts` only does optimistic redirects; the checks that
 * actually matter live as close to the data as possible. That is here. Underneath
 * both sits Row Level Security, which is the layer that holds even if this one is
 * bypassed.
 *
 * Everything is wrapped in React's `cache()`, so a layout, a page and three server
 * components in the same render all share one round trip instead of five.
 */

/**
 * The signed-in user, from a *verified* JWT.
 *
 * `getClaims()` checks the access token's signature against the project's published
 * ES256 key (fetched once and cached for the process), so this costs no network
 * round trip — where `getUser()` asked the auth server every time, ~270ms before any
 * page could start its own queries. The trade-off is that a revoked session stays
 * valid until its access token expires (≤1h); Row Level Security verifies the same
 * token on every query, so nothing here is trusted more than the database trusts it.
 * `getSession()` is still never used on the server: it decodes without verifying.
 */
export const getUser = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
});

/** Redirects to login rather than returning null. Use in pages that require a user. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Requires a *finished* profile. An account exists from the moment they authenticate
 * — the `handle_new_user` trigger guarantees that — but it is not usable until they
 * have chosen a name and username, which is what `onboarded_at` records.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) await requireUser();
  if (!profile) redirect("/login");
  if (!profile.onboarded_at) redirect("/onboarding");
  return profile;
}

export type Membership = { group: Group; role: Role };

/** Every group this user belongs to, most recently active first. */
export const getMyGroups = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("role, groups(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!data) return [];

  return data
    .map((row) => {
      const group = row.groups as unknown as Group | null;
      return group ? { group, role: row.role as Role } : null;
    })
    .filter((row): row is Membership => row !== null)
    .sort((a, b) => b.group.updated_at.localeCompare(a.group.updated_at));
});

/**
 * Resolve a group from its URL slug *and* prove membership in one round trip.
 *
 * The inner join on `group_members` filtered to this user means a non-member gets no
 * row at all — and RLS on `groups` would hide it anyway. Returning `null` rather than
 * throwing is deliberate: the caller renders a 404, so probing slugs cannot tell
 * "does not exist" apart from "exists, you're not in it".
 */
export const getGroupBySlug = cache(
  async (slug: string): Promise<Membership | null> => {
    const user = await getUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("groups")
      .select("*, group_members!inner(role)")
      .eq("slug", slug)
      .eq("group_members.user_id", user.id)
      .maybeSingle();

    if (!data) return null;
    const { group_members: rows, ...group } = data as unknown as Group & {
      group_members: Array<{ role: Role }>;
    };
    const role = rows?.[0]?.role;
    if (!role) return null;
    groupIds.set(slug, group.id);
    return { group, role };
  },
);

/** Group-scoped page guard: profile complete, group exists, caller is a member. */
export const requireGroup = cache(async (slug: string) => {
  // Independent reads, so they share one round trip instead of queueing.
  const [profile, membership] = await Promise.all([requireProfile(), getGroupBySlug(slug)]);
  if (!membership) notFound();
  return { profile, group: membership.group, role: membership.role };
});

/**
 * slug → group id, remembered for the life of the server process.
 *
 * A room's data queries only need the id, and waiting for `requireGroup` to learn it
 * would put the membership check and the room's own reads back into a queue. The id
 * is not a secret and not an authorization: every read is still filtered by RLS, and
 * pages still `await requireGroup` (which 404s non-members) before rendering. So a
 * page can start both at once and render only when both agree.
 */
const groupIds = new Map<string, string>();

export async function groupIdFor(slug: string): Promise<string> {
  const known = groupIds.get(slug);
  if (known) return known;
  const membership = await getGroupBySlug(slug);
  if (!membership) notFound();
  return membership.group.id;
}

/** Members of a group, with their profiles. Used by the member wall and avatar stacks. */
export const getGroupMembers = cache(
  async (groupId: string): Promise<Array<{ role: Role; profile: Profile }>> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("group_members")
      .select("role, profiles(*)")
      .eq("group_id", groupId);

    if (!data) return [];

    const rank: Record<Role, number> = { owner: 0, admin: 1, member: 2 };
    return data
      .map((row) => {
        const profile = row.profiles as unknown as Profile | null;
        return profile ? { role: row.role as Role, profile } : null;
      })
      .filter((row): row is { role: Role; profile: Profile } => row !== null)
      .sort(
        (a, b) =>
          rank[a.role] - rank[b.role] ||
          a.profile.display_name.localeCompare(b.profile.display_name),
      );
  },
);

/**
 * What a room needs to *start* reading: the group id and the viewer id, without
 * waiting on the membership check. Pages run their reads alongside `requireGroup`
 * and render only once both are back — RLS means a non-member's reads come back
 * empty anyway, and `requireGroup` then 404s them.
 */
export async function roomContext(slug: string): Promise<{ groupId: string; viewerId: string }> {
  const [groupId, user] = await Promise.all([groupIdFor(slug), getUser()]);
  if (!user) redirect("/login");
  return { groupId, viewerId: user.id };
}
