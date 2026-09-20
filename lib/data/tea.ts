import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars } from "@/lib/data/media";
import type { Profile, Tea, TeaMessage, TeaStatus } from "@/lib/supabase/database.types";

export type TeaSummary = Tea & {
  author: Profile | null;
  messageCount: number;
  voices: Profile[];
};

export type TeaMessageWithAuthor = TeaMessage & {
  author: Profile | null;
  reactions: Array<{ reaction: string; userIds: string[] }>;
};

/**
 * Tea list, grouped by status by the caller.
 *
 * The message count and the participant faces come from one extra query each for the
 * whole page rather than per-tea — nine conversations would otherwise be eighteen
 * round trips before anything renders.
 */
export async function listTeas(groupId: string): Promise<{
  teas: TeaSummary[];
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("teas")
    .select("*, profiles:created_by(*)")
    .eq("group_id", groupId)
    .order("updated_at", { ascending: false });

  const teas = (rows ?? []).map((row) => ({
    ...(row as unknown as Tea),
    author: (row as unknown as { profiles: Profile | null }).profiles ?? null,
    messageCount: 0,
    voices: [] as Profile[],
  }));

  if (teas.length === 0) return { teas, avatars: new Map() };

  const ids = teas.map((tea) => tea.id);
  const { data: messages } = await supabase
    .from("tea_messages")
    .select("tea_id, user_id, profiles:user_id(*)")
    .in("tea_id", ids);

  const counts = new Map<string, number>();
  const voices = new Map<string, Map<string, Profile>>();

  for (const row of messages ?? []) {
    counts.set(row.tea_id, (counts.get(row.tea_id) ?? 0) + 1);
    const profile = (row as unknown as { profiles: Profile | null }).profiles;
    if (!profile) continue;
    const perTea = voices.get(row.tea_id) ?? new Map<string, Profile>();
    perTea.set(profile.id, profile);
    voices.set(row.tea_id, perTea);
  }

  for (const tea of teas) {
    tea.messageCount = counts.get(tea.id) ?? 0;
    tea.voices = [...(voices.get(tea.id)?.values() ?? [])];
  }

  const everyone = [
    ...teas.flatMap((tea) => tea.voices),
    ...teas.map((tea) => tea.author).filter((a): a is Profile => Boolean(a)),
  ];

  return { teas, avatars: await resolveAvatars(everyone) };
}

export async function getTea(teaId: string): Promise<{
  tea: (Tea & { author: Profile | null }) | null;
  messages: TeaMessageWithAuthor[];
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  // RLS returns nothing for a tea in another group, so a bad id is simply "not found".
  const { data: teaRow } = await supabase
    .from("teas")
    .select("*, profiles:created_by(*)")
    .eq("id", teaId)
    .maybeSingle();

  if (!teaRow) return { tea: null, messages: [], avatars: new Map() };

  const [{ data: messageRows }, { data: reactionRows }] = await Promise.all([
    supabase
      .from("tea_messages")
      .select("*, profiles:user_id(*)")
      .eq("tea_id", teaId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tea_reactions")
      .select("message_id, reaction, user_id")
      .in(
        "message_id",
        // Scoped by the message list below; an empty `in` would match nothing, which
        // is the correct result for a conversation with no messages yet.
        (
          await supabase.from("tea_messages").select("id").eq("tea_id", teaId)
        ).data?.map((m) => m.id) ?? [],
      ),
  ]);

  const grouped = new Map<string, Map<string, string[]>>();
  for (const row of reactionRows ?? []) {
    const perMessage = grouped.get(row.message_id) ?? new Map<string, string[]>();
    perMessage.set(row.reaction, [...(perMessage.get(row.reaction) ?? []), row.user_id]);
    grouped.set(row.message_id, perMessage);
  }

  const messages: TeaMessageWithAuthor[] = (messageRows ?? []).map((row) => ({
    ...(row as unknown as TeaMessage),
    author: (row as unknown as { profiles: Profile | null }).profiles ?? null,
    reactions: [...(grouped.get(row.id)?.entries() ?? [])].map(([reaction, userIds]) => ({
      reaction,
      userIds,
    })),
  }));

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
