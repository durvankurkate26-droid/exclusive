import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars, signVaultMedia, isExternal } from "@/lib/data/media";
import type {
  MemoryCapsule,
  MemoryMedia,
  MemoryNote,
  Profile,
} from "@/lib/supabase/database.types";

/**
 * VAULT's data.
 *
 * The bucket is private, so nothing in here is renderable by path — every image has
 * to come back as a short-lived signed URL. That constraint is why the shape of these
 * functions is "collect every path in the view, sign once, hand back resolved rows"
 * rather than the more natural "return rows and let the component ask". A capsule
 * grid of nine memories with four preview images each is thirty-six signatures; done
 * per-image that is thirty-six round trips before first paint.
 *
 * `previews` is the small set of images a capsule shows on the wall, in sort order.
 * The gallery gets everything, but only once you are inside the capsule.
 */

const PREVIEW_COUNT = 4;

export type ResolvedMedia = MemoryMedia & { url: string | null };

export type CapsuleSummary = MemoryCapsule & {
  author: Profile | null;
  people: Profile[];
  mediaCount: number;
  coverUrl: string | null;
  previews: ResolvedMedia[];
  /** One note, used as the fragment of text on the capsule's face. */
  fragment: (MemoryNote & { author: Profile | null }) | null;
};

export type CapsuleDetail = MemoryCapsule & {
  author: Profile | null;
  people: Profile[];
  coverUrl: string | null;
  media: ResolvedMedia[];
  notes: Array<MemoryNote & { author: Profile | null }>;
  /** Whether the viewer is tagged as having been there. */
  mine: boolean;
};

/** A capsule's cover can be a storage path, an absolute URL, or nothing yet. */
function resolveCover(
  capsule: MemoryCapsule,
  signed: Map<string, string>,
  fallback: ResolvedMedia | undefined,
): string | null {
  if (capsule.cover_url) {
    if (isExternal(capsule.cover_url)) return capsule.cover_url;
    return signed.get(capsule.cover_url) ?? null;
  }
  // No cover chosen: the first image is the memory's face. Better than a grey box,
  // and it means a capsule is never ugly just because nobody picked one.
  return fallback?.url ?? null;
}

export async function listCapsules(groupId: string): Promise<{
  capsules: CapsuleSummary[];
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("memory_capsules")
    .select("*, profiles:created_by(*)")
    .eq("group_id", groupId)
    .order("memory_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const capsules = (rows ?? []).map((row) => row as unknown as MemoryCapsule);
  if (capsules.length === 0) return { capsules: [], avatars: new Map() };

  const ids = capsules.map((capsule) => capsule.id);

  const [{ data: mediaRows }, { data: memberRows }, { data: noteRows }] =
    await Promise.all([
      supabase
        .from("memory_media")
        .select("*")
        .in("capsule_id", ids)
        .order("sort_order")
        .order("created_at"),
      supabase.from("memory_members").select("capsule_id, profiles:user_id(*)").in("capsule_id", ids),
      supabase
        .from("memory_notes")
        .select("*, profiles:user_id(*)")
        .in("capsule_id", ids)
        .order("created_at"),
    ]);

  const media = (mediaRows ?? []) as unknown as MemoryMedia[];

  // One signing call for every path this page will show — previews and covers both.
  const coverPaths = capsules
    .map((capsule) => capsule.cover_url)
    .filter((url): url is string => Boolean(url) && !isExternal(url));

  const byCapsule = new Map<string, MemoryMedia[]>();
  for (const item of media) {
    byCapsule.set(item.capsule_id, [...(byCapsule.get(item.capsule_id) ?? []), item]);
  }

  const previewPaths = [...byCapsule.values()].flatMap((items) =>
    items.slice(0, PREVIEW_COUNT).map((item) => item.storage_path),
  );

  const signed = await signVaultMedia([...coverPaths, ...previewPaths]);

  const peopleByCapsule = new Map<string, Profile[]>();
  const everyone: Profile[] = [];
  for (const row of memberRows ?? []) {
    const profile = (row as unknown as { profiles: Profile | null }).profiles;
    if (!profile) continue;
    peopleByCapsule.set(row.capsule_id, [
      ...(peopleByCapsule.get(row.capsule_id) ?? []),
      profile,
    ]);
    everyone.push(profile);
  }

  const fragmentByCapsule = new Map<string, MemoryNote & { author: Profile | null }>();
  for (const row of noteRows ?? []) {
    const note = row as unknown as MemoryNote;
    if (fragmentByCapsule.has(note.capsule_id)) continue;
    const author = (row as unknown as { profiles: Profile | null }).profiles ?? null;
    fragmentByCapsule.set(note.capsule_id, { ...note, author });
    if (author) everyone.push(author);
  }

  const summaries: CapsuleSummary[] = (rows ?? []).map((row) => {
    const capsule = row as unknown as MemoryCapsule;
    const author = (row as unknown as { profiles: Profile | null }).profiles ?? null;
    if (author) everyone.push(author);

    const items = byCapsule.get(capsule.id) ?? [];
    const previews: ResolvedMedia[] = items.slice(0, PREVIEW_COUNT).map((item) => ({
      ...item,
      url: signed.get(item.storage_path) ?? null,
    }));

    return {
      ...capsule,
      author,
      people: peopleByCapsule.get(capsule.id) ?? [],
      mediaCount: items.length,
      coverUrl: resolveCover(capsule, signed, previews[0]),
      previews,
      fragment: fragmentByCapsule.get(capsule.id) ?? null,
    };
  });

  return { capsules: summaries, avatars: await resolveAvatars(everyone) };
}

export async function getCapsule(
  capsuleId: string,
  viewerId: string,
): Promise<{ capsule: CapsuleDetail | null; avatars: Map<string, string | null> }> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("memory_capsules")
    .select("*, profiles:created_by(*)")
    .eq("id", capsuleId)
    .maybeSingle();

  if (!row) return { capsule: null, avatars: new Map() };

  const capsule = row as unknown as MemoryCapsule;
  const author = (row as unknown as { profiles: Profile | null }).profiles ?? null;

  const [{ data: mediaRows }, { data: memberRows }, { data: noteRows }] =
    await Promise.all([
      supabase
        .from("memory_media")
        .select("*")
        .eq("capsule_id", capsuleId)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("memory_members")
        .select("profiles:user_id(*)")
        .eq("capsule_id", capsuleId),
      supabase
        .from("memory_notes")
        .select("*, profiles:user_id(*)")
        .eq("capsule_id", capsuleId)
        .order("created_at"),
    ]);

  const rawMedia = (mediaRows ?? []) as unknown as MemoryMedia[];
  const coverPath =
    capsule.cover_url && !isExternal(capsule.cover_url) ? [capsule.cover_url] : [];

  const signed = await signVaultMedia([
    ...coverPath,
    ...rawMedia.map((item) => item.storage_path),
  ]);

  const media: ResolvedMedia[] = rawMedia.map((item) => ({
    ...item,
    url: signed.get(item.storage_path) ?? null,
  }));

  const people = (memberRows ?? [])
    .map((entry) => (entry as unknown as { profiles: Profile | null }).profiles)
    .filter((p): p is Profile => Boolean(p));

  const notes = (noteRows ?? []).map((entry) => ({
    ...(entry as unknown as MemoryNote),
    author: (entry as unknown as { profiles: Profile | null }).profiles ?? null,
  }));

  const avatars = await resolveAvatars([
    ...people,
    ...notes.map((note) => note.author).filter((a): a is Profile => Boolean(a)),
    ...(author ? [author] : []),
  ]);

  return {
    capsule: {
      ...capsule,
      author,
      people,
      coverUrl: resolveCover(capsule, signed, media[0]),
      media,
      notes,
      mine: people.some((person) => person.id === viewerId),
    },
    avatars,
  };
}
