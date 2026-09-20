"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/session";

export type FormState = { error?: string; message?: string };

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/**
 * Finish onboarding.
 *
 * `onboarded_at` is what the resolver and `requireProfile` read, so it is set last and
 * only once everything else validated — a half-saved profile should still route the
 * user back here rather than into a group with a blank name.
 */
export async function completeOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();

  if (displayName.length < 2 || displayName.length > 40) {
    return { error: "A name between 2 and 40 characters." };
  }
  if (!USERNAME_RE.test(username)) {
    return { error: "Username: 3–20 characters, lowercase letters, numbers or _." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    // 23505 is a unique violation, and the only unique constraint reachable here is
    // the case-insensitive username index.
    if (error.code === "23505") return { error: "That username is taken. Try another." };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  if (displayName.length < 2) return { error: "A name, at least two characters." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, bio: bio || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { message: "Saved." };
}

/**
 * Avatar upload.
 *
 * The path is forced to `<user_id>/<name>` because the storage policy checks the first
 * segment against auth.uid() — a client-chosen path is how you end up letting someone
 * overwrite another member's avatar.
 */
export async function uploadAvatar(formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick an image." };
  if (file.size > 5 * 1024 * 1024) return { error: "Under 5MB, please." };
  if (!file.type.startsWith("image/")) return { error: "Images only." };

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { message: "Looking good." };
}
