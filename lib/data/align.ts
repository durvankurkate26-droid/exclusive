import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars } from "@/lib/data/media";
import { getGroupMembers } from "@/lib/data/session";
import type {
  Attendance,
  OptionType,
  Plan,
  PlanOption,
  Profile,
} from "@/lib/supabase/database.types";

/**
 * ALIGN's data.
 *
 * Everything here is shaped around one question — what is stopping this? — so the
 * central type is not "plan with options" but `blockers`: the four things that can be
 * unresolved, each either answered or still open, with the evidence (options, votes,
 * faces) attached to the open ones.
 *
 * `unresolved` is what the list page sorts by. A plan with one open question is
 * closer to happening than one with three, and closeness is the only ordering that
 * matters in a room about getting things over the line.
 */

export type OptionWithVotes = PlanOption & {
  voters: Profile[];
  /** Whether the viewer voted for this one. */
  mine: boolean;
};

export type BlockerKey = OptionType | "who";

export type Blocker = {
  key: BlockerKey;
  /** The question, phrased the way a person would ask it out loud. */
  question: string;
  resolved: boolean;
  /** The settled answer, once there is one. */
  answer: string | null;
  options: OptionWithVotes[];
  /** The option currently ahead. What Lock Plan will use. */
  leader: OptionWithVotes | null;
};

export type PlanSummary = Plan & {
  author: Profile | null;
  inCount: number;
  maybeCount: number;
  outCount: number;
  unresolved: string[];
  people: Profile[];
  /** Where it started and what it became, for the lineage line on the list. */
  from: { room: "one-day" | "create"; id: string; title: string } | null;
  memoryId: string | null;
};

export type PlanDetail = PlanSummary & {
  blockers: Blocker[];
  attendance: Array<{ profile: Profile; status: Attendance }>;
  /** The viewer's own answer, or null if they have not said. */
  myAttendance: Attendance | null;
  memberCount: number;
  /** Where this came from, so the plan room can link back to it. */
  origin: { room: "one-day" | "create"; id: string; title: string } | null;
  /** The capsule this became, once it has happened. Without it, a plan marked
      "already in the Vault" is a dead end with nothing to click. */
  capsuleId: string | null;
};

const QUESTIONS: Record<BlockerKey, string> = {
  date: "When?",
  location: "Where?",
  budget: "What's it costing?",
  who: "Who's actually coming?",
};

/** Budget is optional — a plan can be locked without one. Date and place cannot. */
export const REQUIRED_BLOCKERS: BlockerKey[] = ["date", "location"];

function summarise(
  plan: Plan,
  attendance: Array<{ status: Attendance }>,
  memberCount: number,
): { unresolved: string[]; inCount: number; maybeCount: number; outCount: number } {
  const inCount = attendance.filter((a) => a.status === "in").length;
  const maybeCount = attendance.filter((a) => a.status === "maybe").length;
  const outCount = attendance.filter((a) => a.status === "out").length;

  const unresolved: string[] = [];
  if (!plan.final_date) unresolved.push("date");
  if (!plan.final_location) unresolved.push("place");
  // "Who" counts as unresolved while fewer than half the group has committed — a
  // plan four of nine people have answered is not a plan yet.
  if (inCount < Math.ceil(memberCount / 2)) unresolved.push("who");

  return { unresolved, inCount, maybeCount, outCount };
}

type RosterRow = { attendance_status: string; user_id?: string; profiles: Profile | null };

/**
 * Every plan in the group with its roster embedded — one request, where it used to be
 * the plan list, then the member count, then the roster, one after another.
 */
export async function listPlans(groupId: string): Promise<{
  open: PlanSummary[];
  locked: PlanSummary[];
  done: PlanSummary[];
  memberCount: number;
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const [{ data: rows }, members] = await Promise.all([
    supabase
      .from("plans")
      .select(
        "*, profiles:created_by(*), plan_members(attendance_status, profiles:user_id(*)), one_day_ideas(id, title), create_ideas(id, title), memory_capsules(id)",
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    getGroupMembers(groupId),
  ]);

  const memberCount = members.length;
  const plans = (rows ?? []) as unknown as Array<
    Plan & {
      profiles: Profile | null;
      plan_members: RosterRow[];
      one_day_ideas: { id: string; title: string } | null;
      create_ideas: { id: string; title: string } | null;
      memory_capsules: Array<{ id: string }>;
    }
  >;

  if (plans.length === 0) {
    return { open: [], locked: [], done: [], memberCount, avatars: new Map() };
  }

  const everyone: Profile[] = [];
  const summaries: PlanSummary[] = plans.map(({ profiles: author, plan_members, one_day_ideas: idea, create_ideas: make, memory_capsules: saved, ...plan }) => {
    const roster = (plan_members ?? []).map((row) => ({
      status: row.attendance_status as Attendance,
      profile: row.profiles,
    }));
    for (const entry of roster) if (entry.profile) everyone.push(entry.profile);
    if (author) everyone.push(author);
    return {
      ...(plan as Plan),
      author: author ?? null,
      ...summarise(plan as Plan, roster, memberCount),
      people: roster
        .filter((entry) => entry.status === "in")
        .map((entry) => entry.profile)
        .filter((p): p is Profile => Boolean(p)),
      from: idea
        ? { room: "one-day" as const, id: idea.id, title: idea.title }
        : make
          ? { room: "create" as const, id: make.id, title: make.title }
          : null,
      memoryId: saved?.[0]?.id ?? null,
    };
  });

  const avatars = await resolveAvatars(everyone);

  return {
    // Fewest blockers first: the plan closest to happening is the one that needs a
    // human right now.
    open: summaries
      .filter((plan) => plan.status === "open")
      .sort((a, b) => a.unresolved.length - b.unresolved.length),
    locked: summaries.filter((plan) => plan.status === "locked"),
    done: summaries.filter(
      (plan) => plan.status === "done" || plan.status === "cancelled",
    ),
    memberCount,
    avatars,
  };
}

type PlanRow = Plan & {
  profiles: Profile | null;
  plan_options: Array<PlanOption & { plan_votes: Array<{ profiles: Profile | null }> }>;
  plan_members: RosterRow[];
  one_day_ideas: { id: string; title: string } | null;
  create_ideas: { id: string; title: string } | null;
  memory_capsules: Array<{ id: string; created_at: string }>;
};

/**
 * One plan, with everything the room shows embedded in the same request: options with
 * their voters, the roster, where it came from, and the memory it became. That was six
 * requests in a row; now it is one, plus the (cached) member list beside it.
 */
export async function getPlan(
  planId: string,
  viewerId: string,
  groupId: string,
): Promise<{ plan: PlanDetail | null; avatars: Map<string, string | null> }> {
  const supabase = await createClient();

  const [{ data: row }, members] = await Promise.all([
    supabase
      .from("plans")
      .select(
        `*, profiles:created_by(*),
         plan_options(*, plan_votes(profiles:user_id(*))),
         plan_members(attendance_status, user_id, profiles:user_id(*)),
         one_day_ideas(id, title),
         create_ideas(id, title),
         memory_capsules(id, created_at)`,
      )
      .eq("id", planId)
      .eq("group_id", groupId)
      .order("created_at", { referencedTable: "plan_options" })
      .maybeSingle(),
    getGroupMembers(groupId),
  ]);

  if (!row) return { plan: null, avatars: new Map() };

  const {
    profiles: author,
    plan_options,
    plan_members,
    one_day_ideas: sourceIdea,
    create_ideas: sourceCreate,
    memory_capsules: capsules,
    ...rest
  } = row as unknown as PlanRow;
  const plan = rest as Plan;

  const voters: Profile[] = [];
  const withVotes: OptionWithVotes[] = (plan_options ?? []).map(({ plan_votes, ...option }) => {
    const people = (plan_votes ?? []).map((v) => v.profiles).filter((p): p is Profile => Boolean(p));
    voters.push(...people);
    return { ...(option as PlanOption), voters: people, mine: people.some((p) => p.id === viewerId) };
  });

  const attendance = (plan_members ?? [])
    .map((entry) =>
      entry.profiles ? { profile: entry.profiles, status: entry.attendance_status as Attendance } : null,
    )
    .filter((entry): entry is { profile: Profile; status: Attendance } => entry !== null);

  const memberCount = members.length;
  const counts = summarise(plan, attendance, memberCount);

  const buildBlocker = (key: OptionType, answer: string | null): Blocker => {
    const own = withVotes
      .filter((option) => option.option_type === key)
      .sort(
        (a, b) => b.voters.length - a.voters.length || a.created_at.localeCompare(b.created_at),
      );
    return {
      key,
      question: QUESTIONS[key],
      resolved: Boolean(answer),
      answer,
      options: own,
      leader: own[0] ?? null,
    };
  };

  const blockers: Blocker[] = [
    buildBlocker("date", plan.final_date),
    buildBlocker("location", plan.final_location),
    buildBlocker("budget", plan.final_budget),
    {
      key: "who",
      question: QUESTIONS.who,
      resolved: !counts.unresolved.includes("who"),
      answer: `${counts.inCount} of ${memberCount} in`,
      options: [],
      leader: null,
    },
  ];

  // Where this plan came from, so the room can point back at the idea or the shoot.
  const origin: PlanDetail["origin"] = sourceIdea
    ? { room: "one-day", id: sourceIdea.id, title: sourceIdea.title }
    : sourceCreate
      ? { room: "create", id: sourceCreate.id, title: sourceCreate.title }
      : null;
  const capsule = [...(capsules ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const avatars = await resolveAvatars([
    ...voters,
    ...attendance.map((entry) => entry.profile),
    ...(author ? [author] : []),
  ]);

  return {
    plan: {
      ...plan,
      author: author ?? null,
      ...counts,
      people: attendance.filter((a) => a.status === "in").map((a) => a.profile),
      blockers,
      attendance,
      myAttendance:
        attendance.find((entry) => entry.profile.id === viewerId)?.status ?? null,
      memberCount,
      origin,
      capsuleId: capsule?.id ?? null,
      from: origin,
      memoryId: capsule?.id ?? null,
    },
    avatars,
  };
}
