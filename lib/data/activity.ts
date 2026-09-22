import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getGroupMembers } from "@/lib/data/session";
import { weekday } from "@/lib/format";
import type { RoomKey } from "@/lib/constants/rooms";

/**
 * The pulse — "Vidhi joined Goa", "Piyush voted Saturday".
 *
 * Deliberately *not* an activity table. Every sentence here is derived from a row
 * that already exists for its own reasons (an interest row, a vote, an upload), read
 * back by `created_at`. Nothing has to be written twice, nothing can drift out of
 * sync, and a deleted vote simply stops being news. The cost is a handful of small
 * bounded queries, which for a group of nine is nothing.
 *
 * Every query is scoped to the group through an inner join and, underneath that,
 * RLS — so a member can only ever read their own group's pulse.
 */

export type ActivityItem = {
  id: string;
  at: string;
  who: string | null;
  room: RoomKey;
  /** Sentence after the name, e.g. "is in for Goa". */
  text: string;
  href: string;
};

const WINDOW_DAYS = 21;
const PER_SOURCE = 12;

type Row = Record<string, unknown>;

export const getActivity = cache(
  async (groupId: string, slug: string, limit = 24): Promise<ActivityItem[]> => {
    const supabase = await createClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
    const base = `/g/${slug}`;

    const [teas, ideas, interest, votes, plans, creates, crew, capsules, media, joins, members] =
      await Promise.all([
        supabase
          .from("teas")
          .select("id, title, created_by, created_at")
          .eq("group_id", groupId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE),
        supabase
          .from("one_day_ideas")
          .select("id, title, created_by, created_at")
          .eq("group_id", groupId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE),
        supabase
          .from("one_day_interest")
          .select("id, user_id, created_at, one_day_ideas!inner(id, title, group_id, created_by)")
          .eq("one_day_ideas.group_id", groupId)
          .eq("interested", true)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE),
        supabase
          .from("plan_votes")
          .select("id, user_id, created_at, plan_options!inner(value, option_type, plans!inner(id, title, group_id))")
          .eq("plan_options.plans.group_id", groupId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE),
        supabase
          .from("plans")
          .select("id, title, created_by, created_at, status, updated_at")
          .eq("group_id", groupId)
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(PER_SOURCE),
        supabase
          .from("create_ideas")
          .select("id, title, created_by, created_at")
          .eq("group_id", groupId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE),
        supabase
          .from("create_members")
          .select("id, user_id, created_at, create_ideas!inner(id, title, group_id, created_by)")
          .eq("create_ideas.group_id", groupId)
          .eq("participation_status", "in")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE),
        supabase
          .from("memory_capsules")
          .select("id, title, created_by, created_at")
          .eq("group_id", groupId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE),
        supabase
          .from("memory_media")
          .select("id, uploaded_by, created_at, memory_capsules!inner(id, title, group_id)")
          .eq("memory_capsules.group_id", groupId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("group_members")
          .select("id, user_id, created_at")
          .eq("group_id", groupId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE),
        // Names come from the member list (request-cached, usually already loaded by
        // the page) rather than a second profiles query after the sort.
        getGroupMembers(groupId),
      ]);

    const items: Array<ActivityItem & { userId: string | null }> = [];
    const push = (item: ActivityItem & { userId: string | null }) => items.push(item);

    for (const t of (teas.data ?? []) as Row[]) {
      push({
        id: `tea-${t.id}`, at: String(t.created_at), userId: String(t.created_by), who: null,
        room: "tea", text: `started a tea: “${t.title}”`, href: `${base}/tea/${t.id}`,
      });
    }

    for (const i of (ideas.data ?? []) as Row[]) {
      push({
        id: `idea-${i.id}`, at: String(i.created_at), userId: String(i.created_by), who: null,
        room: "one-day", text: `put up ${i.title}`, href: `${base}/one-day/${i.id}`,
      });
    }

    for (const r of (interest.data ?? []) as Row[]) {
      const idea = r.one_day_ideas as Row;
      // The author's own hand goes up automatically with the idea — not news twice.
      if (idea.created_by === r.user_id) continue;
      push({
        id: `interest-${r.id}`, at: String(r.created_at), userId: String(r.user_id), who: null,
        room: "one-day", text: `is in for ${idea.title}`, href: `${base}/one-day/${idea.id}`,
      });
    }

    for (const v of (votes.data ?? []) as Row[]) {
      const option = v.plan_options as Row;
      const plan = option.plans as Row;
      const value =
        option.option_type === "date" && /^\d{4}-\d{2}-\d{2}/.test(String(option.value))
          ? weekday(String(option.value).slice(0, 10)).toLowerCase().replace(/^./, (c) => c.toUpperCase())
          : String(option.value);
      push({
        id: `vote-${v.id}`, at: String(v.created_at), userId: String(v.user_id), who: null,
        room: "align", text: `voted ${value} for ${plan.title}`, href: `${base}/align/${plan.id}`,
      });
    }

    for (const p of (plans.data ?? []) as Row[]) {
      if (p.status === "locked") {
        push({
          id: `lock-${p.id}`, at: String(p.updated_at), userId: null, who: null,
          room: "align", text: `${p.title} is locked. It's happening.`, href: `${base}/align/${p.id}`,
        });
      } else if (String(p.created_at) >= since) {
        push({
          id: `plan-${p.id}`, at: String(p.created_at), userId: String(p.created_by), who: null,
          room: "align", text: `started figuring out ${p.title}`, href: `${base}/align/${p.id}`,
        });
      }
    }

    for (const c of (creates.data ?? []) as Row[]) {
      push({
        id: `create-${c.id}`, at: String(c.created_at), userId: String(c.created_by), who: null,
        room: "create", text: `wants to make ${c.title}`, href: `${base}/create/${c.id}`,
      });
    }

    for (const m of (crew.data ?? []) as Row[]) {
      const creation = m.create_ideas as Row;
      if (creation.created_by === m.user_id) continue;
      push({
        id: `crew-${m.id}`, at: String(m.created_at), userId: String(m.user_id), who: null,
        room: "create", text: `is down for ${creation.title}`, href: `${base}/create/${creation.id}`,
      });
    }

    for (const c of (capsules.data ?? []) as Row[]) {
      push({
        id: `capsule-${c.id}`, at: String(c.created_at), userId: String(c.created_by), who: null,
        room: "vault", text: `opened a memory, ${c.title}`, href: `${base}/vault/${c.id}`,
      });
    }

    // Uploads collapse per person per capsule: "added 14 photos to Marine Drive".
    const batches = new Map<string, { at: string; userId: string; count: number; capsule: Row }>();
    for (const m of (media.data ?? []) as Row[]) {
      const capsule = m.memory_capsules as Row;
      const key = `${m.uploaded_by}:${capsule.id}`;
      const batch = batches.get(key);
      if (batch) batch.count += 1;
      else batches.set(key, { at: String(m.created_at), userId: String(m.uploaded_by), count: 1, capsule });
    }
    for (const [key, b] of batches) {
      push({
        id: `media-${key}`, at: b.at, userId: b.userId, who: null, room: "vault",
        text: `added ${b.count} ${b.count === 1 ? "photo" : "photos"} to ${b.capsule.title}`,
        href: `${base}/vault/${b.capsule.id}`,
      });
    }

    for (const j of (joins.data ?? []) as Row[]) {
      push({
        id: `join-${j.id}`, at: String(j.created_at), userId: String(j.user_id), who: null,
        room: "home", text: "joined the group", href: `${base}/members`,
      });
    }

    items.sort((a, b) => b.at.localeCompare(a.at));
    const top = items.slice(0, limit);

    const names = new Map(members.map((m) => [m.profile.id, m.profile.display_name.split(" ")[0]]));

    return top.map(({ userId, ...item }) => ({
      ...item,
      who: userId ? (names.get(userId) ?? "Someone") : null,
    }));
  },
);
