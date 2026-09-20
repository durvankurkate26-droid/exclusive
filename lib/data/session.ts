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

export const getUser = cache(async () => {
  const supabase = await createClient();
  // getUser() revalidates the token with the auth server. getSession() only decodes
  // the cookie, so it cannot tell a revoked session from a live one.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
  await requireUser();
  const profile = await getProfile();
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
 * Resolve a group from its URL slug *and* prove membership in one step.
 *
 * Returning `null` rather than throwing for a non-member is deliberate: the caller
 * renders a 404, so probing slugs cannot distinguish "this group does not exist" from
 * "this group exists and you are not in it".
 */
export const getGroupBySlug = cache(
  async (slug: string): Promise<Membership | null> => {
    const user = await getUser();
    if (!user) return null;

    const supabase = await createClient();
    // RLS already restricts `groups` to groups you belong to, so a non-member simply
    // gets no row back. The explicit membership read below is what gives us the role.
    const { data: group } = await supabase
      .from("groups")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (!group) return null;

    const { data: membership } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) return null;
    return { group, role: membership.role as Role };
  },
);

/** Group-scoped page guard: profile complete, group exists, caller is a member. */
export async function requireGroup(slug: string) {
  const profile = await requireProfile();
  const membership = await getGroupBySlug(slug);
  // Not "forbidden" — as far as this session is concerned the group is not there, so
  // probing slugs cannot tell "does not exist" apart from "exists, you're not in it".
  if (!membership) notFound();
  return { profile, group: membership.group, role: membership.role };
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
