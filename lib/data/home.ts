import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars, signVaultMedia, isExternal } from "@/lib/data/media";
import type {
  CreateIdea,
  MemoryCapsule,
  OneDayIdea,
  Plan,
  Profile,
  Tea,
} from "@/lib/supabase/database.types";

export type HomeSnapshot = {
  brewing:
    | (Tea & {
        author: Profile | null;
        messageCount: number;
        voices: Profile[];
        last: { content: string; author: string; at: string } | null;
      })
    | null;
  rising: (OneDayIdea & { interested: number; people: Profile[]; holdout: string | null }) | null;
  deciding:
    | (Plan & { unresolved: string[]; inCount: number; leadingDate: string | null; leadingPlace: string | null })
    | null;
  upcoming: (Plan & { people: Profile[] }) | null;
  making: (CreateIdea & { people: Profile[] }) | null;
  lastMemory: (MemoryCapsule & { mediaCount: number; coverUrl: string | null; people: Profile[] }) | null;
  stats: { messages24h: number; photos7d: number; teaCount: number };
  memberCount: number;
  avatars: Map<string, string | null>;
};

/**
 * Home's data.
 *
 * Small targeted queries rather than an activity-feed table: each room is asked for
 * its single most interesting row. Home shows what is *live*, not a log. Every query
 * is bounded by RLS to this group.
 */
export async function getHomeSnapshot(groupId: string): Promise<HomeSnapshot> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [teaRes, ideaRes, planRes, lockedRes, createRes, capsuleRes, memberRes, teaIds, photoRes] =
    await Promise.all([
      supabase
        .from("teas")
        .select("*, profiles:created_by(*)")
        .eq("group_id", groupId)
        .eq("status", "brewing")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("one_day_ideas")
        .select("*")
        .eq("group_id", groupId)
        .in("status", ["idea", "ready_to_plan"])
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("plans")
        .select("*")
        .eq("group_id", groupId)
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("plans")
        .select("*")
        .eq("group_id", groupId)
        .eq("status", "locked")
        .gte("final_date", today)
        .order("final_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("create_ideas")
        .select("*")
        .eq("group_id", groupId)
        .not("status", "in", "(completed,posted)")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("memory_capsules")
        .select("*")
        .eq("group_id", groupId)
        .order("memory_date", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("group_members").select("user_id, profiles(id, display_name)").eq("group_id", groupId),
      supabase.from("teas").select("id").eq("group_id", groupId),
      supabase
        .from("memory_media")
        .select("id, memory_capsules!inner(group_id)", { count: "exact", head: true })
        .eq("memory_capsules.group_id", groupId)
        .gte("created_at", weekAgo),
    ]);

  const memberRows = (memberRes.data ?? []) as unknown as Array<{
    user_id: string;
    profiles: Pick<Profile, "id" | "display_name"> | null;
  }>;
  const memberCount = memberRows.length;
  const profilesToResolve: Array<{ id: string; avatar_url: string | null }> = [];
  const allTeaIds = (teaIds.data ?? []).map((t) => t.id);

  const { count: messages24h } = allTeaIds.length
    ? await supabase
        .from("tea_messages")
        .select("id", { count: "exact", head: true })
        .in("tea_id", allTeaIds)
        .gte("created_at", dayAgo)
    : { count: 0 };

  // --- brewing tea, with the last thing said in it
  let brewing: HomeSnapshot["brewing"] = null;
  if (teaRes.data) {
    const author = (teaRes.data as unknown as { profiles: Profile | null }).profiles;
    const { data: rows } = await supabase
      .from("tea_messages")
      .select("content, created_at, user_id, profiles:user_id(*)")
      .eq("tea_id", teaRes.data.id)
      .order("created_at", { ascending: false });

    const voices = new Map<string, Profile>();
    for (const row of rows ?? []) {
      const p = (row as unknown as { profiles: Profile | null }).profiles;
      if (p) voices.set(p.id, p);
    }
    const lastRow = rows?.[0] as unknown as
      | { content: string; created_at: string; profiles: Profile | null }
      | undefined;

    brewing = {
      ...(teaRes.data as Tea),
      author: author ?? null,
      messageCount: rows?.length ?? 0,
      voices: [...voices.values()],
      last: lastRow
        ? {
            content: lastRow.content,
            author: lastRow.profiles?.display_name.split(" ")[0] ?? "someone",
            at: lastRow.created_at,
          }
        : null,
    };
    profilesToResolve.push(...voices.values());
    if (author) profilesToResolve.push(author);
  }

  // --- the idea with the most hands up, and who is holding out
  let rising: HomeSnapshot["rising"] = null;
  const ideas = ideaRes.data ?? [];
  if (ideas.length > 0) {
    const { data: interest } = await supabase
      .from("one_day_interest")
      .select("idea_id, user_id, profiles:user_id(*)")
      .in("idea_id", ideas.map((idea) => idea.id))
      .eq("interested", true);

    const byIdea = new Map<string, Profile[]>();
    for (const row of interest ?? []) {
      const profile = (row as unknown as { profiles: Profile | null }).profiles;
      const list = byIdea.get(row.idea_id) ?? [];
      if (profile) list.push(profile);
      byIdea.set(row.idea_id, list);
    }

    const best = ideas
      .map((idea) => ({ idea, people: byIdea.get(idea.id) ?? [] }))
      .sort((a, b) => b.people.length - a.people.length)[0];

    if (best && best.people.length > 0) {
      const inIds = new Set(best.people.map((p) => p.id));
      // Deterministic, not random: the first member alphabetically who has not said yes.
      const holdout =
        memberRows
          .map((m) => m.profiles)
          .filter((p): p is Pick<Profile, "id" | "display_name"> => Boolean(p) && !inIds.has(p!.id))
          .sort((a, b) => a.display_name.localeCompare(b.display_name))[0]
          ?.display_name.split(" ")[0] ?? null;

      rising = { ...best.idea, interested: best.people.length, people: best.people, holdout };
      profilesToResolve.push(...best.people);
    }
  }

  // --- the open plan, what is blocking it, and what the group is leaning toward
  let deciding: HomeSnapshot["deciding"] = null;
  if (planRes.data) {
    const plan = planRes.data as Plan;
    const [{ data: options }, { data: attendance }] = await Promise.all([
      supabase.from("plan_options").select("id, option_type, value, plan_votes(user_id)").eq("plan_id", plan.id),
      supabase.from("plan_members").select("attendance_status").eq("plan_id", plan.id),
    ]);

    const lead = (type: string) =>
      ((options ?? []) as unknown as Array<{ option_type: string; value: string; plan_votes: unknown[] }>)
        .filter((o) => o.option_type === type)
        .sort((a, b) => b.plan_votes.length - a.plan_votes.length)[0]?.value ?? null;

    const inCount = (attendance ?? []).filter((a) => a.attendance_status === "in").length;
    const unresolved: string[] = [];
    if (!plan.final_date && !lead("date")) unresolved.push("date");
    if (!plan.final_location && !lead("location")) unresolved.push("place");
    if (inCount < Math.ceil(memberCount / 2)) unresolved.push("who's coming");

    deciding = { ...plan, unresolved, inCount, leadingDate: lead("date"), leadingPlace: lead("location") };
  }

  // --- the next thing that is definitely happening
  let upcoming: HomeSnapshot["upcoming"] = null;
  if (lockedRes.data) {
    const plan = lockedRes.data as Plan;
    const { data: going } = await supabase
      .from("plan_members")
      .select("profiles:user_id(*)")
      .eq("plan_id", plan.id)
      .eq("attendance_status", "in");
    const people = (going ?? [])
      .map((row) => (row as unknown as { profiles: Profile | null }).profiles)
      .filter((p): p is Profile => Boolean(p));
    upcoming = { ...plan, people };
    profilesToResolve.push(...people);
  }

  // --- what the group is currently making
  let making: HomeSnapshot["making"] = null;
  if (createRes.data) {
    const creation = createRes.data as CreateIdea;
    const { data: people } = await supabase
      .from("create_members")
      .select("profiles:user_id(*)")
      .eq("create_id", creation.id)
      .eq("participation_status", "in");

    const profiles = (people ?? [])
      .map((row) => (row as unknown as { profiles: Profile | null }).profiles)
      .filter((p): p is Profile => Boolean(p));

    making = { ...creation, people: profiles };
    profilesToResolve.push(...profiles);
  }

  // --- the last thing worth remembering, with its face
  let lastMemory: HomeSnapshot["lastMemory"] = null;
  if (capsuleRes.data) {
    const capsule = capsuleRes.data as MemoryCapsule;
    const [{ data: media, count }, { data: members }] = await Promise.all([
      supabase
        .from("memory_media")
        .select("storage_path", { count: "exact" })
        .eq("capsule_id", capsule.id)
        .order("sort_order")
        .limit(1),
      supabase.from("memory_members").select("profiles:user_id(*)").eq("capsule_id", capsule.id),
    ]);
    const coverPath =
      capsule.cover_url && !isExternal(capsule.cover_url) ? capsule.cover_url : media?.[0]?.storage_path;
    const signed = coverPath ? await signVaultMedia([coverPath]) : new Map<string, string>();
    const people = (members ?? [])
      .map((row) => (row as unknown as { profiles: Profile | null }).profiles)
      .filter((p): p is Profile => Boolean(p));
    lastMemory = {
      ...capsule,
      mediaCount: count ?? 0,
      coverUrl: capsule.cover_url && isExternal(capsule.cover_url) ? capsule.cover_url : coverPath ? (signed.get(coverPath) ?? null) : null,
      people,
    };
    profilesToResolve.push(...people);
  }

  const avatars = await resolveAvatars(profilesToResolve);

  return {
    brewing,
    rising,
    deciding,
    upcoming,
    making,
    lastMemory,
    stats: { messages24h: messages24h ?? 0, photos7d: photoRes.count ?? 0, teaCount: allTeaIds.length },
    memberCount,
    avatars,
  };
}

/**
 * The line at the top of Home.
 *
 * Deterministic, never generated: a fixed ladder of rules over real counts, checked
 * in order of how much the group should care. The first rule that holds wins. Two
 * lines, the second lit in the room colour.
 */
export function groupPulse(s: HomeSnapshot, activity7d: number): {
  lines: [string, string];
  room: "align" | "tea" | "one-day" | "vault" | "home";
} {
  const weekday = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: "long" }).toUpperCase();

  if (s.upcoming?.final_date) {
    const days = Math.round((new Date(s.upcoming.final_date).getTime() - Date.now()) / 86400000);
    if (days <= 7) return { lines: [`${weekday(s.upcoming.final_date)} IS`, "HAPPENING."], room: "align" };
    return { lines: [`${s.upcoming.people.length} OF YOU HAVE`, "PLANS NOW."], room: "align" };
  }

  if (s.deciding && s.deciding.unresolved.length <= 1 && s.deciding.leadingDate) {
    return { lines: [`${weekday(s.deciding.leadingDate)} MIGHT`, "ACTUALLY HAPPEN."], room: "align" };
  }

  if (s.rising && s.rising.interested >= Math.max(3, Math.ceil(s.memberCount / 2))) {
    const title = s.rising.title.toUpperCase();
    const short = title.length <= 22 ? title : `THIS ONE`;
    return { lines: [`${s.rising.interested} PEOPLE ARE`, `SERIOUS ABOUT ${short}.`], room: "one-day" };
  }

  if (s.stats.messages24h >= 15) return { lines: ["TEA IS GETTING", "OUT OF HAND."], room: "tea" };

  if (s.stats.photos7d >= 5) {
    return { lines: ["YOU PEOPLE MADE", `${s.stats.photos7d} MEMORIES THIS WEEK.`], room: "vault" };
  }

  if (activity7d >= 8) return { lines: ["THE GROUP HAS", "BEEN BUSY."], room: "home" };
  if (s.brewing) return { lines: ["SOMETHING IS", "BREWING."], room: "tea" };

  return { lines: ["SUSPICIOUSLY", "PEACEFUL."], room: "home" };
}
