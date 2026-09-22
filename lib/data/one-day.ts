import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars } from "@/lib/data/media";
import { getGroupMembers } from "@/lib/data/session";
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

type IdeaRow = OneDayIdea & {
  profiles: Profile | null;
  one_day_interest: Array<{ interested: boolean; profiles: Profile | null }>;
};

/** Hands are embedded in the idea's own query; this just unpacks them. */
function unpack(row: IdeaRow, viewerId: string): IdeaSummary {
  const { profiles: author, one_day_interest, ...idea } = row;
  const people = (one_day_interest ?? [])
    .filter((entry) => entry.interested)
    .map((entry) => entry.profiles)
    .filter((p): p is Profile => Boolean(p));
  return { ...(idea as OneDayIdea), author: author ?? null, people, mine: people.some((p) => p.id === viewerId) };
}

const IDEA_SELECT = "*, profiles:created_by(*), one_day_interest(interested, profiles:user_id(*))";

/**
 * The wall.
 *
 * Ordered by hands raised, not by date. ONE DAY is a list of futures competing for
 * the group's attention, and the one eight people want should not be below the one
 * somebody typed this morning. One request: every idea with its hands embedded.
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

  const [{ data: rows }, members] = await Promise.all([
    supabase
      .from("one_day_ideas")
      .select(IDEA_SELECT)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    getGroupMembers(groupId),
  ]);

  const merged = ((rows ?? []) as unknown as IdeaRow[]).map((row) => unpack(row, viewerId));

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
    ...merged.flatMap((i) => i.people),
    ...merged.map((i) => i.author).filter((a): a is Profile => Boolean(a)),
  ]);

  return { ideas: live, promoted, memberCount: members.length, avatars };
}

export async function getIdea(
  ideaId: string,
  viewerId: string,
  groupId: string,
): Promise<{
  idea: IdeaSummary | null;
  memberCount: number;
  /** The plan this became, if somebody already made it real. */
  planId: string | null;
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const [{ data: row }, members] = await Promise.all([
    supabase
      .from("one_day_ideas")
      .select(`${IDEA_SELECT}, plans(id, created_at)`)
      .eq("id", ideaId)
      .eq("group_id", groupId)
      .maybeSingle(),
    getGroupMembers(groupId),
  ]);

  if (!row) return { idea: null, memberCount: members.length, planId: null, avatars: new Map() };

  const { plans, ...rest } = row as unknown as IdeaRow & { plans: Array<{ id: string; created_at: string }> };
  const idea = unpack(rest as IdeaRow, viewerId);
  const plan = [...(plans ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return {
    idea,
    memberCount: members.length,
    planId: plan?.id ?? null,
    avatars: await resolveAvatars([...idea.people, ...(idea.author ? [idea.author] : [])]),
  };
}
