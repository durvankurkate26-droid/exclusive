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
  /** What this memory grew out of, where the rows still exist. */
  lineage: {
    plan: { id: string; title: string } | null;
    create: { id: string; title: string } | null;
    idea: { id: string; title: string } | null;
  };
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

type CapsuleRow = MemoryCapsule & {
  profiles: Profile | null;
  memory_members: Array<{ profiles: Profile | null }>;
};

/**
 * The wall of memories, in one request: each capsule arrives with its first few
 * photos, an exact photo count, who was there and its first line, all embedded — then
 * one signing call for every image the page will actually show. Previews are limited
 * per capsule inside the query, so a capsule with 300 photos costs the same as one
 * with four.
 */
export async function listCapsules(groupId: string): Promise<{
  capsules: CapsuleSummary[];
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("memory_capsules")
    .select(
      `*, profiles:created_by(*),
       memory_members(profiles:user_id(*)),
       media_count:memory_media(count),
       previews:memory_media(*),
       fragment:memory_notes(*, profiles:user_id(*))`,
    )
    .eq("group_id", groupId)
    .order("memory_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "previews" })
    .order("created_at", { referencedTable: "previews" })
    .limit(PREVIEW_COUNT, { referencedTable: "previews" })
    .order("created_at", { referencedTable: "fragment" })
    .limit(1, { referencedTable: "fragment" });

  const capsules = (rows ?? []) as unknown as Array<
    CapsuleRow & {
      media_count: Array<{ count: number }>;
      previews: MemoryMedia[];
      fragment: Array<MemoryNote & { profiles: Profile | null }>;
    }
  >;
  if (capsules.length === 0) return { capsules: [], avatars: new Map() };

  // One signing call for every path this page will show — previews and covers both.
  const signed = await signVaultMedia([
    ...capsules
      .map((capsule) => capsule.cover_url)
      .filter((url): url is string => Boolean(url) && !isExternal(url)),
    ...capsules.flatMap((capsule) => (capsule.previews ?? []).map((item) => item.storage_path)),
  ]);

  const everyone: Profile[] = [];
  const summaries: CapsuleSummary[] = capsules.map(
    ({ profiles: author, memory_members, media_count, previews: items, fragment: notes, ...rest }) => {
      const capsule = rest as MemoryCapsule;
      const people = (memory_members ?? []).map((m) => m.profiles).filter((p): p is Profile => Boolean(p));
      const first = notes?.[0];
      const fragment = first ? { ...(first as MemoryNote), author: first.profiles ?? null } : null;
      everyone.push(...people);
      if (author) everyone.push(author);
      if (fragment?.author) everyone.push(fragment.author);

      const previews: ResolvedMedia[] = (items ?? []).map((item) => ({
        ...item,
        url: signed.get(item.storage_path) ?? null,
      }));

      return {
        ...capsule,
        author: author ?? null,
        people,
        mediaCount: media_count?.[0]?.count ?? 0,
        coverUrl: resolveCover(capsule, signed, previews[0]),
        previews,
        fragment,
      };
    },
  );

  return { capsules: summaries, avatars: await resolveAvatars(everyone) };
}

/**
 * One memory, whole: every photo, who was there, everything anybody said — one
 * request and one signing call.
 */
export async function getCapsule(
  capsuleId: string,
  viewerId: string,
  groupId: string,
): Promise<{ capsule: CapsuleDetail | null; avatars: Map<string, string | null> }> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("memory_capsules")
    .select(
      `*, profiles:created_by(*),
       memory_media(*),
       memory_members(profiles:user_id(*)),
       memory_notes(*, profiles:user_id(*)),
       plans(id, title),
       create_ideas(id, title),
       one_day_ideas(id, title)`,
    )
    .eq("id", capsuleId)
    .eq("group_id", groupId)
    .order("sort_order", { referencedTable: "memory_media" })
    .order("created_at", { referencedTable: "memory_media" })
    .order("created_at", { referencedTable: "memory_notes" })
    .maybeSingle();

  if (!row) return { capsule: null, avatars: new Map() };

  const {
    profiles: author,
    memory_media: rawMedia,
    memory_members,
    memory_notes,
    plans: sourcePlan,
    create_ideas: sourceCreate,
    one_day_ideas: sourceIdea,
    ...rest
  } = row as unknown as CapsuleRow & {
    memory_media: MemoryMedia[];
    memory_notes: Array<MemoryNote & { profiles: Profile | null }>;
    plans: { id: string; title: string } | null;
    create_ideas: { id: string; title: string } | null;
    one_day_ideas: { id: string; title: string } | null;
  };
  const capsule = rest as MemoryCapsule;

  const signed = await signVaultMedia([
    ...(capsule.cover_url && !isExternal(capsule.cover_url) ? [capsule.cover_url] : []),
    ...(rawMedia ?? []).map((item) => item.storage_path),
  ]);

  const media: ResolvedMedia[] = (rawMedia ?? []).map((item) => ({
    ...item,
    url: signed.get(item.storage_path) ?? null,
  }));

  const people = (memory_members ?? []).map((m) => m.profiles).filter((p): p is Profile => Boolean(p));
  const notes = (memory_notes ?? []).map(({ profiles, ...note }) => ({
    ...(note as MemoryNote),
    author: profiles ?? null,
  }));

  const avatars = await resolveAvatars([
    ...people,
    ...notes.map((note) => note.author).filter((a): a is Profile => Boolean(a)),
    ...(author ? [author] : []),
  ]);

  return {
    capsule: {
      ...capsule,
      author: author ?? null,
      people,
      coverUrl: resolveCover(capsule, signed, media[0]),
      media,
      notes,
      mine: people.some((person) => person.id === viewerId),
      lineage: {
        plan: sourcePlan ?? null,
        create: sourceCreate ?? null,
        idea: sourceIdea ?? null,
      },
    },
    avatars,
  };
}
