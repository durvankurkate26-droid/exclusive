"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/session";
import type { FormState } from "./profile";

export type { FormState };

/**
 * VAULT's writes.
 *
 * The storage path is built here and never accepted from the client:
 * `<group_id>/<capsule_id>/<file>`, because the bucket policy checks that first
 * segment against real membership. A client-chosen path is how you end up letting
 * somebody write into another group's folder.
 */

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** Keep a recognisable name, drop anything that could confuse a path. */
function safeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(-48) || "image.jpg";
}

export async function createCapsule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const groupId = String(formData.get("group_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const memoryDate = String(formData.get("memory_date") ?? "").trim();

  if (!title) return { error: "What was it? Name the night." };
  if (title.length > 120) return { error: "Shorter title, please." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memory_capsules")
    .insert({
      group_id: groupId,
      created_by: user.id,
      title,
      description: description || null,
      memory_date: memoryDate || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Whoever opens the capsule was there. They can untag themselves if not.
  await supabase
    .from("memory_members")
    .insert({ capsule_id: data.id, user_id: user.id });

  revalidatePath(`/g/${slug}/vault`);
  redirect(`/g/${slug}/vault/${data.id}`);
}

export async function updateCapsule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const capsuleId = String(formData.get("capsule_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const memoryDate = String(formData.get("memory_date") ?? "").trim();

  if (!title) return { error: "It still needs a name." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("memory_capsules")
    .update({
      title,
      description: description || null,
      memory_date: memoryDate || null,
    })
    .eq("id", capsuleId);

  if (error) return { error: error.message };

  revalidatePath(`/g/${slug}/vault`);
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return { message: "Saved." };
}

/**
 * Upload images into a capsule.
 *
 * Multiple files in one submission, uploaded sequentially rather than in parallel: a
 * phone dumping twelve photos over a hotel connection is better served by twelve
 * ordered requests than twelve competing ones, and a partial success here still
 * leaves every file that did land visible in the gallery.
 */
export async function uploadMemoryMedia(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const capsuleId = String(formData.get("capsule_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const files = formData
    .getAll("media")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) return { error: "Pick some photos first." };

  const supabase = await createClient();

  // Continue the existing order rather than restarting at zero, so a second upload
  // lands after the first batch instead of interleaving with it.
  const { data: last } = await supabase
    .from("memory_media")
    .select("sort_order")
    .eq("capsule_id", capsuleId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let order = (last?.sort_order ?? -1) + 1;
  let uploaded = 0;
  let failure: string | null = null;

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      failure = `${file.name} is over 25MB.`;
      continue;
    }
    if (!ALLOWED.includes(file.type)) {
      failure = `${file.name} isn't an image we can take.`;
      continue;
    }

    const path = `${groupId}/${capsuleId}/${Date.now()}-${order}-${safeName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("vault-media")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      failure = uploadError.message;
      continue;
    }

    const { error: rowError } = await supabase.from("memory_media").insert({
      capsule_id: capsuleId,
      uploaded_by: user.id,
      storage_path: path,
      media_type: "image",
      sort_order: order,
    });

    if (rowError) {
      // The object is in the bucket but has no row, so nothing will ever show it.
      // Remove it rather than leaving an orphan behind.
      await supabase.storage.from("vault-media").remove([path]);
      failure = rowError.message;
      continue;
    }

    order += 1;
    uploaded += 1;
  }

  revalidatePath(`/g/${slug}/vault`);
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);

  if (uploaded === 0) return { error: failure ?? "Nothing uploaded." };
  if (failure) return { message: `${uploaded} in. ${failure}` };
  return { message: uploaded === 1 ? "In the vault." : `${uploaded} in the vault.` };
}

export async function setCapsuleCover(
  capsuleId: string,
  slug: string,
  storagePath: string,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("memory_capsules")
    .update({ cover_url: storagePath })
    .eq("id", capsuleId);

  if (error) return { error: error.message };

  revalidatePath(`/g/${slug}/vault`);
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return { message: "That's the one." };
}

/** Removes the row and the object. Only the uploader passes both policies. */
export async function deleteMemoryMedia(
  mediaId: string,
  capsuleId: string,
  slug: string,
): Promise<FormState> {
  const supabase = await createClient();

  const { data: media } = await supabase
    .from("memory_media")
    .select("storage_path")
    .eq("id", mediaId)
    .maybeSingle();

  const { error } = await supabase.from("memory_media").delete().eq("id", mediaId);
  if (error) return { error: error.message };

  if (media?.storage_path) {
    await supabase.storage.from("vault-media").remove([media.storage_path]);
    // A cover pointing at a deleted object would render as a hole in the wall.
    await supabase
      .from("memory_capsules")
      .update({ cover_url: null })
      .eq("id", capsuleId)
      .eq("cover_url", media.storage_path);
  }

  revalidatePath(`/g/${slug}/vault`);
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return {};
}

export async function addMemoryNote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const capsuleId = String(formData.get("capsule_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!note) return { error: "Say something." };
  if (note.length > 500) return { error: "Under 500 characters." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("memory_notes")
    .insert({ capsule_id: capsuleId, user_id: user.id, note });

  if (error) return { error: error.message };

  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return {};
}

export async function deleteMemoryNote(
  noteId: string,
  capsuleId: string,
  slug: string,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("memory_notes").delete().eq("id", noteId);
  if (error) return { error: error.message };
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return {};
}

/** Tag or untag somebody as having been there. */
export async function toggleCapsuleParticipant(
  capsuleId: string,
  userId: string,
  slug: string,
): Promise<FormState> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("memory_members")
    .select("id")
    .eq("capsule_id", capsuleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("memory_members").delete().eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("memory_members")
      .insert({ capsule_id: capsuleId, user_id: userId });
    if (error) return { error: error.message };
  }

  revalidatePath(`/g/${slug}/vault`);
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return {};
}

/**
 * Delete a whole capsule.
 *
 * The rows cascade, but storage objects do not — Postgres knows nothing about the
 * bucket — so the files are removed first. An orphaned object is invisible and
 * un-deletable through the UI, which in a private photo vault is the wrong kind of
 * forever.
 */
export async function deleteCapsule(capsuleId: string, slug: string): Promise<void> {
  const supabase = await createClient();

  const { data: media } = await supabase
    .from("memory_media")
    .select("storage_path")
    .eq("capsule_id", capsuleId);

  const paths = (media ?? []).map((item) => item.storage_path).filter(Boolean);
  if (paths.length > 0) await supabase.storage.from("vault-media").remove(paths);

  await supabase.from("memory_capsules").delete().eq("id", capsuleId);

  revalidatePath(`/g/${slug}/vault`);
  redirect(`/g/${slug}/vault`);
}

/* ===========================================================================
   Client-side uploads.

   Files go straight from the browser to Storage (so the uploader can show real
   byte-level progress — a Server Action body has none, and is capped at 1MB by
   default anyway). This action then records the rows. It re-derives the capsule's
   group and refuses any path outside `<group_id>/<capsule_id>/`, so the folder rule
   the bucket policy enforces is checked again here before a row points at it.
   =========================================================================== */

export async function recordUploads(
  capsuleId: string,
  slug: string,
  files: Array<{ path: string; width?: number; height?: number }>,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };
  if (files.length === 0) return { error: "Nothing uploaded." };

  const supabase = await createClient();
  const { data: capsule } = await supabase
    .from("memory_capsules")
    .select("id, group_id")
    .eq("id", capsuleId)
    .maybeSingle();
  if (!capsule) return { error: "That memory is gone." };

  const prefix = `${capsule.group_id}/${capsule.id}/`;
  if (files.some((file) => !file.path.startsWith(prefix) || file.path.includes(".."))) {
    return { error: "Those files landed in the wrong place." };
  }

  const { data: last } = await supabase
    .from("memory_media")
    .select("sort_order")
    .eq("capsule_id", capsuleId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let order = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("memory_media").insert(
    files.map((file) => ({
      capsule_id: capsuleId,
      uploaded_by: user.id,
      storage_path: file.path,
      media_type: "image" as const,
      width: file.width ?? null,
      height: file.height ?? null,
      sort_order: order++,
    })),
  );

  if (error) {
    await supabase.storage.from("vault-media").remove(files.map((f) => f.path));
    return { error: error.message };
  }

  revalidatePath(`/g/${slug}/vault`);
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return { message: files.length === 1 ? "In the vault." : `${files.length} in the vault.` };
}

export async function setMediaCaption(
  mediaId: string,
  capsuleId: string,
  slug: string,
  caption: string,
): Promise<FormState> {
  const trimmed = caption.trim().slice(0, 200);
  const supabase = await createClient();
  const { error } = await supabase
    .from("memory_media")
    .update({ caption: trimmed || null })
    .eq("id", mediaId);
  if (error) return { error: error.message };
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return {};
}

/** Nudge a photograph one place earlier or later in the essay. */
export async function moveMedia(
  mediaId: string,
  capsuleId: string,
  slug: string,
  direction: -1 | 1,
): Promise<FormState> {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("memory_media")
    .select("id, sort_order")
    .eq("capsule_id", capsuleId)
    .order("sort_order")
    .order("created_at");

  const list = items ?? [];
  const index = list.findIndex((item) => item.id === mediaId);
  const swap = list[index + direction];
  if (index < 0 || !swap) return {};

  // Renumber densely so duplicate sort_orders from older uploads cannot make a swap a no-op.
  const reordered = [...list];
  [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
  const results = await Promise.all(
    reordered.map((item, i) =>
      item.sort_order === i
        ? Promise.resolve({ error: null })
        : supabase.from("memory_media").update({ sort_order: i }).eq("id", item.id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath(`/g/${slug}/vault`);
  revalidatePath(`/g/${slug}/vault/${capsuleId}`);
  return {};
}
