import "server-only";

import { createClient } from "@/lib/supabase/server";

export type MemberStats = { teas: number; plans: number; memories: number; ideas: number };

/**
 * What each person has actually done here — teas started, plans they said yes to,
 * memories they're tagged in, somedays they raised a hand for. Real counts from real
 * rows, used to give each face on the member wall a little context. Four grouped
 * reads for the whole group, not four per person.
 */
export async function getMemberStats(groupId: string): Promise<Map<string, MemberStats>> {
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
      .select("user_id, memory_capsules!inner(group_id)")
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
  for (const row of memories.data ?? []) bump(row.user_id, "memories");
  for (const row of ideas.data ?? []) bump(row.user_id, "ideas");

  return stats;
}
