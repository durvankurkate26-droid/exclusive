import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars } from "@/lib/data/media";
import type { Profile, Tea, TeaMessage, TeaStatus } from "@/lib/supabase/database.types";

export type TeaSummary = Tea & {
  author: Profile | null;
  messageCount: number;
  voices: Profile[];
  /** The most recent line, for the preview. */
  last: { content: string; author: string; at: string } | null;
};

export type TeaMessageWithAuthor = TeaMessage & {
  author: Profile | null;
  reactions: Array<{ reaction: string; userIds: string[] }>;
};

/** How much recent conversation the list reads to find each tea's last line and voices. */
const LIST_WINDOW = 400;
/** How far back a conversation loads. Older lines are still stored, just not rendered. */
const THREAD_WINDOW = 300;

/**
 * Tea list, grouped by status by the caller.
 *
 * One round trip: the teas (with an exact per-tea message count embedded) and the
 * group's most recent messages are fetched side by side. The recent window is what
 * the list actually shows — each tea's last line and who has been talking — so there
 * is no need to read every message ever sent just to count them.
 */
export async function listTeas(groupId: string): Promise<{
  teas: TeaSummary[];
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const [{ data: rows }, { data: messages }] = await Promise.all([
    supabase
      .from("teas")
      .select("*, profiles:created_by(*), tea_messages(count)")
      .eq("group_id", groupId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("tea_messages")
      .select("tea_id, user_id, content, created_at, profiles:user_id(*), teas!inner(group_id)")
      .eq("teas.group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(LIST_WINDOW),
  ]);

  const teas = (rows ?? []).map((row) => {
    const r = row as unknown as Tea & { profiles: Profile | null; tea_messages: Array<{ count: number }> };
    const { profiles, tea_messages, ...tea } = r;
    return {
      ...(tea as Tea),
      author: profiles ?? null,
      messageCount: tea_messages?.[0]?.count ?? 0,
      voices: [] as Profile[],
      last: null as TeaSummary["last"],
    };
  });

  if (teas.length === 0) return { teas, avatars: new Map() };

  const lasts = new Map<string, TeaSummary["last"]>();
  const voices = new Map<string, Map<string, Profile>>();

  // Newest first, so the first line seen per tea is its last line.
  for (const row of messages ?? []) {
    const profile = (row as unknown as { profiles: Profile | null }).profiles;
    if (!lasts.has(row.tea_id)) {
      lasts.set(row.tea_id, {
        content: row.content,
        author: profile?.display_name.split(" ")[0] ?? "someone",
        at: row.created_at,
      });
    }
    if (!profile) continue;
    const perTea = voices.get(row.tea_id) ?? new Map<string, Profile>();
    perTea.set(profile.id, profile);
    voices.set(row.tea_id, perTea);
  }

  for (const tea of teas) {
    tea.voices = [...(voices.get(tea.id)?.values() ?? [])];
    tea.last = lasts.get(tea.id) ?? null;
  }

  const everyone = [
    ...teas.flatMap((tea) => tea.voices),
    ...teas.map((tea) => tea.author).filter((a): a is Profile => Boolean(a)),
  ];

  return { teas, avatars: await resolveAvatars(everyone) };
}

/**
 * One conversation: the tea, its recent messages and their reactions, in a single
 * round trip. Reactions are scoped through their message's tea with an inner join
 * rather than by first fetching the message ids — that pre-fetch used to hide a third
 * sequential request inside what looked like a parallel one.
 */
export async function getTea(teaId: string): Promise<{
  tea: (Tea & { author: Profile | null }) | null;
  messages: TeaMessageWithAuthor[];
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  // RLS returns nothing for a tea in another group, so a bad id is simply "not found".
  const [{ data: teaRow }, { data: messageRows }, { data: reactionRows }] = await Promise.all([
    supabase.from("teas").select("*, profiles:created_by(*)").eq("id", teaId).maybeSingle(),
    supabase
      .from("tea_messages")
      .select("*, profiles:user_id(*)")
      .eq("tea_id", teaId)
      .order("created_at", { ascending: false })
      .limit(THREAD_WINDOW),
    supabase
      .from("tea_reactions")
      .select("message_id, reaction, user_id, tea_messages!inner(tea_id)")
      .eq("tea_messages.tea_id", teaId),
  ]);

  if (!teaRow) return { tea: null, messages: [], avatars: new Map() };

  const grouped = new Map<string, Map<string, string[]>>();
  for (const row of reactionRows ?? []) {
    const perMessage = grouped.get(row.message_id) ?? new Map<string, string[]>();
    perMessage.set(row.reaction, [...(perMessage.get(row.reaction) ?? []), row.user_id]);
    grouped.set(row.message_id, perMessage);
  }

  const messages: TeaMessageWithAuthor[] = (messageRows ?? [])
    .slice()
    .reverse()
    .map((row) => {
      const { profiles, ...message } = row as unknown as TeaMessage & { profiles: Profile | null };
      return {
        ...(message as TeaMessage),
        author: profiles ?? null,
        reactions: [...(grouped.get(message.id)?.entries() ?? [])].map(([reaction, userIds]) => ({
          reaction,
          userIds,
        })),
      };
    });

  const author = (teaRow as unknown as { profiles: Profile | null }).profiles ?? null;
  const people = [
    ...messages.map((m) => m.author).filter((a): a is Profile => Boolean(a)),
    ...(author ? [author] : []),
  ];

  return {
    tea: { ...(teaRow as unknown as Tea), author },
    messages,
    avatars: await resolveAvatars(people),
  };
}

export const TEA_STATUS_LABEL: Record<TeaStatus, string> = {
  brewing: "brewing",
  spilled: "spilled",
  archived: "archived",
};
