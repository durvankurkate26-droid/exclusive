import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars } from "@/lib/data/media";
import type {
  CreateIdea,
  MemoryCapsule,
  OneDayIdea,
  Plan,
  Profile,
  Tea,
} from "@/lib/supabase/database.types";

export type HomeSnapshot = {
  brewing: (Tea & { author: Profile | null; messageCount: number }) | null;
  rising: (OneDayIdea & { interested: number; people: Profile[] }) | null;
  deciding: (Plan & { unresolved: string[]; inCount: number }) | null;
  making: (CreateIdea & { people: Profile[] }) | null;
  lastMemory: (MemoryCapsule & { mediaCount: number }) | null;
  memberCount: number;
  avatars: Map<string, string | null>;
};

/**
 * Home's data.
 *
 * Five small targeted queries rather than an activity-feed table. A feed would mean
 * writing a row on every action in every room and keeping it in sync forever; for a
 * group of nine, asking each room for its single most interesting row is both simpler
 * and more honest — Home shows what is *live*, not what happened.
 *
 * Every query is bounded by RLS to this group, so none of them take a user id.
 */
export async function getHomeSnapshot(groupId: string): Promise<HomeSnapshot> {
  const supabase = await createClient();

  const [teaRes, ideaRes, planRes, createRes, capsuleRes, memberRes] = await Promise.all([
    // Most recently active conversation that is still going.
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
      .limit(8),

    supabase
      .from("plans")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
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

    supabase.from("group_members").select("user_id").eq("group_id", groupId),
  ]);

  const memberCount = memberRes.data?.length ?? 0;
  const profilesToResolve: Array<{ id: string; avatar_url: string | null }> = [];

  // --- brewing tea
  let brewing: HomeSnapshot["brewing"] = null;
  if (teaRes.data) {
    const author = (teaRes.data as unknown as { profiles: Profile | null }).profiles;
    const { count } = await supabase
      .from("tea_messages")
      .select("id", { count: "exact", head: true })
      .eq("tea_id", teaRes.data.id);
    brewing = { ...(teaRes.data as Tea), author: author ?? null, messageCount: count ?? 0 };
    if (author) profilesToResolve.push(author);
  }

  // --- the idea with the most hands up. Ordering by interest needs a count per idea,
  // which is one extra query for the whole set rather than one per idea.
  let rising: HomeSnapshot["rising"] = null;
  const ideas = ideaRes.data ?? [];
  if (ideas.length > 0) {
    const { data: interest } = await supabase
      .from("one_day_interest")
      .select("idea_id, user_id, profiles:user_id(*)")
      .in(
        "idea_id",
        ideas.map((idea) => idea.id),
      )
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

    if (best) {
      rising = { ...best.idea, interested: best.people.length, people: best.people };
      profilesToResolve.push(...best.people);
    }
  }

  // --- the plan closest to happening, and what is still blocking it
  let deciding: HomeSnapshot["deciding"] = null;
  if (planRes.data) {
    const plan = planRes.data as Plan;
    const [{ data: options }, { data: attendance }] = await Promise.all([
      supabase.from("plan_options").select("option_type").eq("plan_id", plan.id),
      supabase.from("plan_members").select("attendance_status").eq("plan_id", plan.id),
    ]);

    const unresolved: string[] = [];
    if (!plan.final_date) unresolved.push("date");
    if (!plan.final_location) unresolved.push("place");
    const inCount = (attendance ?? []).filter((a) => a.attendance_status === "in").length;
    if (inCount < Math.ceil(memberCount / 2)) unresolved.push("who's coming");
    void options;

    deciding = { ...plan, unresolved, inCount };
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

  // --- the last thing worth remembering
  let lastMemory: HomeSnapshot["lastMemory"] = null;
  if (capsuleRes.data) {
    const capsule = capsuleRes.data as MemoryCapsule;
    const { count } = await supabase
      .from("memory_media")
      .select("id", { count: "exact", head: true })
      .eq("capsule_id", capsule.id);
    lastMemory = { ...capsule, mediaCount: count ?? 0 };
  }

  const avatars = await resolveAvatars(profilesToResolve);

  return { brewing, rising, deciding, making, lastMemory, memberCount, avatars };
}
