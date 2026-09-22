import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isExternal, signVaultMedia } from "@/lib/data/media";

export type MemberStats = { teas: number; plans: number; memories: number; ideas: number };
export type MemberMemory = { id: string; title: string; cover: string | null; date: string | null };

/**
 * What each person has actually done here: teas started, plans they said yes to,
 * memories they're tagged in, somedays they raised a hand for. Real counts from real
 * rows, used to give each face on the member wall a little context. Four grouped
 * reads for the whole group, not four per person, plus one signing call for the
 * memory covers shown under each face.
 */
export async function getMemberStats(groupId: string): Promise<{
  stats: Map<string, MemberStats>;
  memories: Map<string, MemberMemory[]>;
}> {
  const supabase = await createClient();

  const [teas, plans, memories, ideas] = await Promise.all([
    supabase.from("teas").select("created_by").eq("group_id", groupId),
    supabase
      .from("plan_members")
      .select("user_id, plans!inner(group_id)")
      .eq("plans.group_id", groupId)
      .eq("attendance_status", "in"),
    supabase
      .from("memory_members")
      .select("user_id, memory_capsules!inner(id, title, cover_url, memory_date, group_id)")
      .eq("memory_capsules.group_id", groupId),
    supabase
      .from("one_day_interest")
      .select("user_id, one_day_ideas!inner(group_id)")
      .eq("one_day_ideas.group_id", groupId)
      .eq("interested", true),
  ]);

  const stats = new Map<string, MemberStats>();
  const bump = (id: string, key: keyof MemberStats) => {
    const entry = stats.get(id) ?? { teas: 0, plans: 0, memories: 0, ideas: 0 };
    entry[key] += 1;
    stats.set(id, entry);
  };

  for (const row of teas.data ?? []) bump(row.created_by, "teas");
  for (const row of plans.data ?? []) bump(row.user_id, "plans");
  for (const row of ideas.data ?? []) bump(row.user_id, "ideas");

  type Tagged = {
    user_id: string;
    memory_capsules: { id: string; title: string; cover_url: string | null; memory_date: string | null };
  };
  const tagged = (memories.data ?? []) as unknown as Tagged[];
  for (const row of tagged) bump(row.user_id, "memories");

  const signed = await signVaultMedia(
    tagged
      .map((row) => row.memory_capsules.cover_url)
      .filter((url): url is string => Boolean(url) && !isExternal(url)),
  );

  const byPerson = new Map<string, MemberMemory[]>();
  for (const { user_id, memory_capsules: c } of tagged) {
    const cover = c.cover_url ? (isExternal(c.cover_url) ? c.cover_url : (signed.get(c.cover_url) ?? null)) : null;
    byPerson.set(user_id, [...(byPerson.get(user_id) ?? []), { id: c.id, title: c.title, cover, date: c.memory_date }]);
  }
  // Newest first, photographed memories before empty ones.
  for (const list of byPerson.values()) {
    list.sort((a, b) => Number(Boolean(b.cover)) - Number(Boolean(a.cover)) || (b.date ?? "").localeCompare(a.date ?? ""));
  }

  return { stats, memories: byPerson };
}
