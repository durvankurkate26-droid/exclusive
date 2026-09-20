import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars } from "@/lib/data/media";
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

export async function listPlans(groupId: string): Promise<{
  open: PlanSummary[];
  locked: PlanSummary[];
  done: PlanSummary[];
  memberCount: number;
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const [{ data: rows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("plans")
      .select("*, profiles:created_by(*)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    supabase.from("group_members").select("user_id").eq("group_id", groupId),
  ]);

  const plans = rows ?? [];
  const memberCount = memberRows?.length ?? 0;

  if (plans.length === 0) {
    return { open: [], locked: [], done: [], memberCount, avatars: new Map() };
  }

  const { data: memberships } = await supabase
    .from("plan_members")
    .select("plan_id, attendance_status, profiles:user_id(*)")
    .in(
      "plan_id",
      plans.map((plan) => plan.id),
    );

  const byPlan = new Map<string, Array<{ status: Attendance; profile: Profile | null }>>();
  const everyone: Profile[] = [];
  for (const row of memberships ?? []) {
    const profile = (row as unknown as { profiles: Profile | null }).profiles;
    byPlan.set(row.plan_id, [
      ...(byPlan.get(row.plan_id) ?? []),
      { status: row.attendance_status as Attendance, profile },
    ]);
    if (profile) everyone.push(profile);
  }

  const summaries: PlanSummary[] = plans.map((row) => {
    const plan = row as unknown as Plan;
    const roster = byPlan.get(plan.id) ?? [];
    const counts = summarise(plan, roster, memberCount);
    return {
      ...plan,
      author: (row as unknown as { profiles: Profile | null }).profiles ?? null,
      ...counts,
      people: roster
        .filter((entry) => entry.status === "in")
        .map((entry) => entry.profile)
        .filter((p): p is Profile => Boolean(p)),
    };
  });

  const avatars = await resolveAvatars([
    ...everyone,
    ...summaries.map((p) => p.author).filter((a): a is Profile => Boolean(a)),
  ]);

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

export async function getPlan(
  planId: string,
  viewerId: string,
): Promise<{ plan: PlanDetail | null; avatars: Map<string, string | null> }> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("plans")
    .select("*, profiles:created_by(*)")
    .eq("id", planId)
    .maybeSingle();

  if (!row) return { plan: null, avatars: new Map() };

  const plan = row as unknown as Plan;
  const author = (row as unknown as { profiles: Profile | null }).profiles ?? null;

  const [{ data: optionRows }, { data: memberRows }, { data: groupRows }] =
    await Promise.all([
      supabase.from("plan_options").select("*").eq("plan_id", planId).order("created_at"),
      supabase
        .from("plan_members")
        .select("attendance_status, user_id, profiles:user_id(*)")
        .eq("plan_id", planId),
      supabase.from("group_members").select("user_id").eq("group_id", plan.group_id),
    ]);

  const options = (optionRows ?? []) as unknown as PlanOption[];

  // One votes query for every option on the plan rather than one per option.
  const { data: voteRows } = options.length
    ? await supabase
        .from("plan_votes")
        .select("option_id, user_id, profiles:user_id(*)")
        .in(
          "option_id",
          options.map((option) => option.id),
        )
    : { data: [] };

  const votesByOption = new Map<string, Profile[]>();
  const voters: Profile[] = [];
  for (const vote of voteRows ?? []) {
    const profile = (vote as unknown as { profiles: Profile | null }).profiles;
    if (!profile) continue;
    votesByOption.set(vote.option_id, [
      ...(votesByOption.get(vote.option_id) ?? []),
      profile,
    ]);
    voters.push(profile);
  }

  const withVotes: OptionWithVotes[] = options.map((option) => {
    const people = votesByOption.get(option.id) ?? [];
    return { ...option, voters: people, mine: people.some((p) => p.id === viewerId) };
  });

  const attendance = (memberRows ?? [])
    .map((entry) => {
      const profile = (entry as unknown as { profiles: Profile | null }).profiles;
      return profile ? { profile, status: entry.attendance_status as Attendance } : null;
    })
    .filter((entry): entry is { profile: Profile; status: Attendance } => entry !== null);

  const memberCount = groupRows?.length ?? 0;
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
  let origin: PlanDetail["origin"] = null;
  if (plan.source_idea_id) {
    const { data: source } = await supabase
      .from("one_day_ideas")
      .select("id, title")
      .eq("id", plan.source_idea_id)
      .maybeSingle();
    if (source) origin = { room: "one-day", id: source.id, title: source.title };
  } else if (plan.source_create_id) {
    const { data: source } = await supabase
      .from("create_ideas")
      .select("id, title")
      .eq("id", plan.source_create_id)
      .maybeSingle();
    if (source) origin = { room: "create", id: source.id, title: source.title };
  }

  const { data: capsule } = await supabase
    .from("memory_capsules")
    .select("id")
    .eq("source_plan_id", plan.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const avatars = await resolveAvatars([
    ...voters,
    ...attendance.map((entry) => entry.profile),
    ...(author ? [author] : []),
  ]);

  return {
    plan: {
      ...plan,
      author,
      ...counts,
      people: attendance.filter((a) => a.status === "in").map((a) => a.profile),
      blockers,
      attendance,
      myAttendance:
        attendance.find((entry) => entry.profile.id === viewerId)?.status ?? null,
      memberCount,
      origin,
      capsuleId: capsule?.id ?? null,
    },
    avatars,
  };
}
