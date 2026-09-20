"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/session";
import type { TeaStatus } from "@/lib/supabase/database.types";
import type { FormState } from "./profile";

export type { FormState };

export async function startTea(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const groupId = String(formData.get("group_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim();

  if (!groupId || !slug) return { error: "Missing group." };
  if (title.length < 1) return { error: "Give it a title. Anything." };
  if (title.length > 140) return { error: "Shorter title, please." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teas")
    // `created_by` is pinned to the session user by RLS too — sending it is just what
    // makes the insert policy's WITH CHECK pass.
    .insert({ group_id: groupId, created_by: user.id, title, context: context || null })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/g/${slug}/tea`);
  redirect(`/g/${slug}/tea/${data.id}`);
}

/**
 * Post a message.
 *
 * Returns rather than redirects: the composer stays put and the new message arrives
 * through the realtime subscription, so the page never navigates mid-conversation.
 */
export async function sendMessage(teaId: string, content: string): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const trimmed = content.trim();
  if (!trimmed) return { error: "Nothing to send." };
  if (trimmed.length > 2000) return { error: "That's too long for one message." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tea_messages")
    .insert({ tea_id: teaId, user_id: user.id, content: trimmed });

  if (error) return { error: error.message };

  // Bumping the parent is what keeps the tea list and Home ordered by real activity.
  await supabase.from("teas").update({ updated_at: new Date().toISOString() }).eq("id", teaId);

  return {};
}

/** Reactions toggle: pressing the same one again takes it back. */
export async function toggleReaction(
  messageId: string,
  reaction: string,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("tea_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("reaction", reaction)
    .maybeSingle();

  if (existing) {
    await supabase.from("tea_reactions").delete().eq("id", existing.id);
    return {};
  }

  const { error } = await supabase
    .from("tea_reactions")
    .insert({ message_id: messageId, user_id: user.id, reaction });

  if (error) return { error: error.message };
  return {};
}

export async function setTeaStatus(
  teaId: string,
  slug: string,
  status: TeaStatus,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("teas").update({ status }).eq("id", teaId);
  if (error) return { error: error.message };

  revalidatePath(`/g/${slug}/tea`);
  revalidatePath(`/g/${slug}/tea/${teaId}`);
  return {};
}
