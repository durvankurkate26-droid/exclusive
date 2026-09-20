import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars } from "@/lib/data/media";
import type { OneDayIdea, Profile } from "@/lib/supabase/database.types";

/**
 * ONE DAY's data.
 *
 * An idea is only interesting in relation to how many people want it, so nothing here
 * returns an idea without its hands. `interested` is a count *and* a face list,
 * because the wall shows both and asking twice would be two round trips.
 */

export type IdeaSummary = OneDayIdea & {
  author: Profile | null;
  people: Profile[];
  /** Whether the viewer has their hand up. Drives the button's state. */
  mine: boolean;
};

async function attachInterest(
  ideas: OneDayIdea[],
  viewerId: string,
): Promise<{ withPeople: Array<OneDayIdea & { people: Profile[]; mine: boolean }>; profiles: Profile[] }> {
  if (ideas.length === 0) return { withPeople: [], profiles: [] };

  const supabase = await createClient();
  const { data } = await supabase
    .from("one_day_interest")
    .select("idea_id, user_id, profiles:user_id(*)")
    .in(
      "idea_id",
      ideas.map((idea) => idea.id),
    )
    .eq("interested", true);

  const byIdea = new Map<string, Profile[]>();
  const everyone: Profile[] = [];
  for (const row of data ?? []) {
    const profile = (row as unknown as { profiles: Profile | null }).profiles;
    if (!profile) continue;
    byIdea.set(row.idea_id, [...(byIdea.get(row.idea_id) ?? []), profile]);
    everyone.push(profile);
  }

  return {
    withPeople: ideas.map((idea) => {
      const people = byIdea.get(idea.id) ?? [];
      return { ...idea, people, mine: people.some((p) => p.id === viewerId) };
    }),
    profiles: everyone,
  };
}

/**
 * The wall.
 *
 * Ordered by hands raised, not by date. ONE DAY is a list of futures competing for
 * the group's attention, and the one eight people want should not be below the one
 * somebody typed this morning.
 */
export async function listIdeas(
  groupId: string,
  viewerId: string,
): Promise<{
  ideas: IdeaSummary[];
  promoted: IdeaSummary[];
  memberCount: number;
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const [{ data: rows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("one_day_ideas")
      .select("*, profiles:created_by(*)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    supabase.from("group_members").select("user_id").eq("group_id", groupId),
  ]);

  const base = (rows ?? []).map((row) => ({
    ...(row as unknown as OneDayIdea),
    author: (row as unknown as { profiles: Profile | null }).profiles ?? null,
  }));

  const { withPeople, profiles } = await attachInterest(base, viewerId);

  const merged: IdeaSummary[] = withPeople.map((idea, index) => ({
    ...idea,
    author: base[index].author,
  }));

  const live = merged
    .filter((idea) => idea.status === "idea" || idea.status === "ready_to_plan")
    .sort(
      (a, b) =>
        b.people.length - a.people.length ||
        b.created_at.localeCompare(a.created_at),
    );

  const promoted = merged.filter(
    (idea) => idea.status === "moved_to_align" || idea.status === "completed",
  );

  const avatars = await resolveAvatars([
    ...profiles,
    ...merged.map((i) => i.author).filter((a): a is Profile => Boolean(a)),
  ]);

  return {
    ideas: live,
    promoted,
    memberCount: memberRows?.length ?? 0,
    avatars,
  };
}

export async function getIdea(
  ideaId: string,
  viewerId: string,
): Promise<{
  idea: IdeaSummary | null;
  memberCount: number;
  /** The plan this became, if somebody already made it real. */
  planId: string | null;
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("one_day_ideas")
    .select("*, profiles:created_by(*)")
    .eq("id", ideaId)
    .maybeSingle();

  if (!row) return { idea: null, memberCount: 0, planId: null, avatars: new Map() };

  const base = row as unknown as OneDayIdea;
  const author = (row as unknown as { profiles: Profile | null }).profiles ?? null;

  const [{ withPeople, profiles }, { data: memberRows }, { data: plan }] =
    await Promise.all([
      attachInterest([base], viewerId),
      supabase.from("group_members").select("user_id").eq("group_id", base.group_id),
      supabase
        .from("plans")
        .select("id")
        .eq("source_idea_id", base.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const idea = withPeople[0];

  return {
    idea: { ...idea, author },
    memberCount: memberRows?.length ?? 0,
    planId: plan?.id ?? null,
    avatars: await resolveAvatars([...profiles, ...(author ? [author] : [])]),
  };
}
