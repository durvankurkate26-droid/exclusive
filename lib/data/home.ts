import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars, signVaultMedia, isExternal } from "@/lib/data/media";
import { daysUntil, weekday } from "@/lib/format";
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
  /** The group's most recent photographs, newest memory first, for the strip. */
  strip: Array<{ id: string; url: string; capsuleId: string; title: string; caption: string | null }>;
  stats: { messages24h: number; photos7d: number; teaCount: number };
  memberCount: number;
  avatars: Map<string, string | null>;
};

type Row = Record<string, unknown>;
const STRIP = 9;
const profilesOf = (rows: unknown): Profile[] =>
  ((rows ?? []) as Array<{ profiles: Profile | null }>)
    .map((row) => row.profiles)
    .filter((p): p is Profile => Boolean(p));

/**
 * Home's data.
 *
 * Small targeted queries rather than an activity-feed table: each room is asked for
 * its single most interesting row. Home shows what is *live*, not a log.
 *
 * Everything a row needs (its messages, hands, votes, crew, photos) is embedded in
 * that row's own query, so the whole snapshot is **one** parallel wave of requests
 * plus a signing call — it used to be ten requests queued one behind another.
 * Every query is bounded by RLS to this group.
 */
export async function getHomeSnapshot(groupId: string): Promise<HomeSnapshot> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [teaRes, ideaRes, planRes, lockedRes, createRes, capsuleRes, memberRes, msgRes, teaCountRes, photoRes, stripRes] =
    await Promise.all([
      supabase
        .from("teas")
        .select(
          "*, profiles:created_by(*), tea_messages(count), recent:tea_messages(content, created_at, user_id, profiles:user_id(*))",
        )
        .eq("group_id", groupId)
        .eq("status", "brewing")
        .order("updated_at", { ascending: false })
        .order("created_at", { referencedTable: "recent", ascending: false })
        .limit(60, { referencedTable: "recent" })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("one_day_ideas")
        .select("*, one_day_interest(interested, profiles:user_id(*))")
        .eq("group_id", groupId)
        .in("status", ["idea", "ready_to_plan"])
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("plans")
        .select("*, plan_options(option_type, value, plan_votes(user_id)), plan_members(attendance_status)")
        .eq("group_id", groupId)
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("plans")
        .select("*, plan_members(attendance_status, profiles:user_id(*))")
        .eq("group_id", groupId)
        .eq("status", "locked")
        .gte("final_date", today)
        .order("final_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("create_ideas")
        .select("*, create_members(participation_status, profiles:user_id(*))")
        .eq("group_id", groupId)
        .not("status", "in", "(completed,posted)")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("memory_capsules")
        // The latest memory that has already happened *and* has a photo: Home's
        // memory slot is a photograph, never an empty plate.
        .select("*, memory_media(count), first:memory_media!inner(storage_path), memory_members(profiles:user_id(*))")
        .eq("group_id", groupId)
        .lte("memory_date", today)
        .order("memory_date", { ascending: false, nullsFirst: false })
        .order("sort_order", { referencedTable: "first" })
        .limit(1, { referencedTable: "first" })
        .limit(1)
        .maybeSingle(),
      supabase.from("group_members").select("user_id, profiles(id, display_name)").eq("group_id", groupId),
      supabase
        .from("tea_messages")
        .select("id, teas!inner(group_id)", { count: "exact", head: true })
        .eq("teas.group_id", groupId)
        .gte("created_at", dayAgo),
      supabase.from("teas").select("id", { count: "exact", head: true }).eq("group_id", groupId),
      supabase
        .from("memory_media")
        .select("id, memory_capsules!inner(group_id)", { count: "exact", head: true })
        .eq("memory_capsules.group_id", groupId)
        .gte("created_at", weekAgo),
      supabase
        .from("memory_media")
        .select("id, storage_path, caption, memory_capsules!inner(id, title, group_id)")
        .eq("memory_capsules.group_id", groupId)
        .eq("media_type", "image")
        .order("created_at", { ascending: false })
        .limit(STRIP),
    ]);

  const memberRows = (memberRes.data ?? []) as unknown as Array<{
    user_id: string;
    profiles: Pick<Profile, "id" | "display_name"> | null;
  }>;
  const memberCount = memberRows.length;
  const profilesToResolve: Array<{ id: string; avatar_url: string | null }> = [];

  // --- brewing tea, with the last thing said in it
  let brewing: HomeSnapshot["brewing"] = null;
  if (teaRes.data) {
    const { profiles: author, tea_messages, recent, ...tea } = teaRes.data as unknown as Tea & {
      profiles: Profile | null;
      tea_messages: Array<{ count: number }>;
      recent: Array<{ content: string; created_at: string; profiles: Profile | null }>;
    };
    const voices = new Map<string, Profile>();
    for (const row of recent ?? []) if (row.profiles) voices.set(row.profiles.id, row.profiles);
    const lastRow = recent?.[0];

    brewing = {
      ...(tea as Tea),
      author: author ?? null,
      messageCount: tea_messages?.[0]?.count ?? 0,
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
  const ideas = (
    (ideaRes.data ?? []) as unknown as Array<
      OneDayIdea & { one_day_interest: Array<{ interested: boolean; profiles: Profile | null }> }
    >
  ).map(({ one_day_interest, ...idea }) => ({
    idea: idea as OneDayIdea,
    people: profilesOf((one_day_interest ?? []).filter((row) => row.interested)),
  }));
  const best = [...ideas].sort((a, b) => b.people.length - a.people.length)[0];
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

  // --- the open plan, what is blocking it, and what the group is leaning toward
  let deciding: HomeSnapshot["deciding"] = null;
  if (planRes.data) {
    const { plan_options: options, plan_members: attendance, ...plan } = planRes.data as unknown as Plan & {
      plan_options: Array<{ option_type: string; value: string; plan_votes: unknown[] }>;
      plan_members: Array<{ attendance_status: string }>;
    };
    const lead = (type: string) =>
      (options ?? [])
        .filter((o) => o.option_type === type)
        .sort((a, b) => b.plan_votes.length - a.plan_votes.length)[0]?.value ?? null;

    const inCount = (attendance ?? []).filter((a) => a.attendance_status === "in").length;
    const unresolved: string[] = [];
    if (!plan.final_date && !lead("date")) unresolved.push("date");
    if (!plan.final_location && !lead("location")) unresolved.push("place");
    if (inCount < Math.ceil(memberCount / 2)) unresolved.push("who's coming");

    deciding = { ...(plan as Plan), unresolved, inCount, leadingDate: lead("date"), leadingPlace: lead("location") };
  }

  // --- the next thing that is definitely happening
  let upcoming: HomeSnapshot["upcoming"] = null;
  if (lockedRes.data) {
    const { plan_members, ...plan } = lockedRes.data as unknown as Plan & {
      plan_members: Array<{ attendance_status: string; profiles: Profile | null }>;
    };
    const people = profilesOf((plan_members ?? []).filter((row) => row.attendance_status === "in"));
    upcoming = { ...(plan as Plan), people };
    profilesToResolve.push(...people);
  }

  // --- what the group is currently making
  let making: HomeSnapshot["making"] = null;
  if (createRes.data) {
    const { create_members, ...creation } = createRes.data as unknown as CreateIdea & {
      create_members: Array<{ participation_status: string; profiles: Profile | null }>;
    };
    const people = profilesOf((create_members ?? []).filter((row) => row.participation_status === "in"));
    making = { ...(creation as CreateIdea), people };
    profilesToResolve.push(...people);
  }

  // --- the last thing worth remembering, with its face
  let lastMemory: HomeSnapshot["lastMemory"] = null;
  let coverPath: string | undefined;
  if (capsuleRes.data) {
    const { memory_media, first, memory_members, ...capsule } = capsuleRes.data as unknown as MemoryCapsule & {
      memory_media: Array<{ count: number }>;
      first: Array<{ storage_path: string }>;
      memory_members: Row[];
    };
    coverPath = capsule.cover_url && !isExternal(capsule.cover_url) ? capsule.cover_url : first?.[0]?.storage_path;
    const people = profilesOf(memory_members);
    lastMemory = {
      ...(capsule as MemoryCapsule),
      mediaCount: memory_media?.[0]?.count ?? 0,
      coverUrl: capsule.cover_url && isExternal(capsule.cover_url) ? capsule.cover_url : null,
      people,
    };
    profilesToResolve.push(...people);
  }

  const stripRows = (stripRes.data ?? []) as unknown as Array<{
    id: string;
    storage_path: string;
    caption: string | null;
    memory_capsules: { id: string; title: string };
  }>;

  // One signing call for the cover and the whole strip.
  const [avatars, signed] = await Promise.all([
    resolveAvatars(profilesToResolve),
    signVaultMedia([...(coverPath ? [coverPath] : []), ...stripRows.map((row) => row.storage_path)]),
  ]);
  if (lastMemory && coverPath && !lastMemory.coverUrl) lastMemory.coverUrl = signed.get(coverPath) ?? null;

  const strip = stripRows
    .map((row) => ({
      id: row.id,
      url: signed.get(row.storage_path) ?? "",
      capsuleId: row.memory_capsules.id,
      title: row.memory_capsules.title,
      caption: row.caption,
    }))
    .filter((frame) => frame.url);

  return {
    brewing,
    rising,
    deciding,
    upcoming,
    making,
    lastMemory,
    strip,
    stats: {
      messages24h: msgRes.count ?? 0,
      photos7d: photoRes.count ?? 0,
      teaCount: teaCountRes.count ?? 0,
    },
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
  if (s.upcoming?.final_date) {
    const days = daysUntil(s.upcoming.final_date);
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
