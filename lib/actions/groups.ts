"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/session";
import type { FormState } from "./profile";

export type { FormState };

/**
 * Create a group.
 *
 * Delegates to the `create_group` RPC rather than doing two client inserts: the group
 * row and the owner's membership row must both land or neither, and a client that
 * inserts the group then dies leaves a group nobody — not even its creator — can see,
 * because the select policy requires membership.
 */
export async function createGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 1 || name.length > 60) {
    return { error: "Give it a name — up to 60 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    group_name: name,
    group_description: description || null,
  });

  if (error) return { error: error.message };

  const created = Array.isArray(data) ? data[0] : data;
  if (!created?.slug) return { error: "Could not create the group. Try again." };

  revalidatePath("/", "layout");
  redirect(`/g/${created.slug}?welcome=1`);
}

/**
 * Join by invite code.
 *
 * Also an RPC, for the opposite reason: the joiner is not yet a member, so RLS hides
 * the group from them entirely. `join_group_by_code` is SECURITY DEFINER and does the
 * lookup, the duplicate check and the insert in one place that re-checks auth.uid().
 */
export async function joinGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();

  if (code.length < 4) return { error: "That code looks too short." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_group_by_code", { code });

  if (error) {
    if (error.code === "P0002" || /invalid invite/i.test(error.message)) {
      return { error: "No group with that code. Check it and try again." };
    }
    return { error: error.message };
  }

  const joined = Array.isArray(data) ? data[0] : data;
  if (!joined?.slug) return { error: "No group with that code." };

  revalidatePath("/", "layout");
  redirect(`/g/${joined.slug}${joined.already_member ? "" : "?welcome=1"}`);
}

export async function rotateInviteCode(groupId: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_invite_code", { gid: groupId });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "New code. The old one is dead." };
}

export async function updateGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const groupId = String(formData.get("group_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!groupId) return { error: "Missing group." };
  if (name.length < 1) return { error: "A group needs a name." };

  const supabase = await createClient();
  // RLS restricts this update to admins; no separate role check is needed here.
  const { error } = await supabase
    .from("groups")
    .update({ name, description: description || null })
    .eq("id", groupId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function leaveGroup(groupId: string): Promise<void> {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
  redirect("/groups");
}

export async function removeMember(groupId: string, userId: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "Removed." };
}

export async function deleteGroup(groupId: string): Promise<void> {
  const supabase = await createClient();
  // Only an owner passes the delete policy; everything else cascades from the row.
  await supabase.from("groups").delete().eq("id", groupId);
  revalidatePath("/", "layout");
  redirect("/groups");
}
