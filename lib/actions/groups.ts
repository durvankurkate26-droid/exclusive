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

/**
 * Leave.
 *
 * An owner cannot: the RLS policy excludes `role = 'owner'`, because a group whose
 * owner walked out is one nobody can administer or delete. Rather than redirecting
 * them to `/groups` while they are quietly still a member, this reports what happened.
 */
export async function leaveGroup(groupId: string): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return {
      error:
        "You own this group. Owners can't leave — delete it instead, or stay.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/groups");
}

/**
 * Promote or demote a member.
 *
 * Only `admin` and `member` are reachable: ownership is not a role you hand out from
 * a dropdown, and the RLS delete policy already assumes exactly one owner exists.
 * Admins pass the update policy; everyone else gets nothing back and a clear message.
 */
export async function setMemberRole(
  groupId: string,
  userId: string,
  role: "admin" | "member",
): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_members")
    .update({ role })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .neq("role", "owner")
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "You can't change that person's role." };

  revalidatePath("/", "layout");
  return { message: role === "admin" ? "They can run things now." : "Back to member." };
}

export async function removeMember(groupId: string, userId: string): Promise<FormState> {
  const supabase = await createClient();
  // `.select()` makes the result honest: a delete blocked by RLS returns no error and
  // no rows, so without this the UI would happily say "Removed." about somebody who
  // is still in the group.
  const { data, error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "You can't remove them. An owner can only delete the group, not be removed from it." };
  }

  revalidatePath("/", "layout");
  return { message: "Removed." };
}

export async function deleteGroup(groupId: string): Promise<FormState> {
  const supabase = await createClient();
  // Only an owner passes the delete policy; everything else cascades from the row.
  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Only the owner can delete this group." };

  revalidatePath("/", "layout");
  redirect("/groups");
}
