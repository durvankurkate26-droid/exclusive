import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed URLs for private buckets.
 *
 * Both buckets are private, so nothing can be rendered by path alone — every image
 * needs a short-lived signed URL minted after Supabase has checked the storage policy.
 *
 * The important part is `createSignedUrls` (plural). Signing one URL per avatar in a
 * nine-person member wall is nine round trips before the page can render; batching
 * makes it one. `cache()` then collapses repeats within a single render, so a layout
 * and three components asking for the same avatar share one signature.
 */

const AVATAR_TTL = 60 * 60; // 1 hour — avatars are re-signed on every page load anyway.
const MEDIA_TTL = 60 * 60;

async function signBatch(
  bucket: string,
  paths: string[],
  ttl: number,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, ttl);
  if (error || !data) return out;

  for (const row of data) {
    // A path the caller is not allowed to read comes back with an error and no URL;
    // leaving it out of the map makes the UI fall back to initials rather than a
    // broken image, which is the right failure for a privacy boundary.
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  }
  return out;
}

export const signAvatars = cache(
  async (paths: string[]): Promise<Map<string, string>> =>
    signBatch("avatars", paths, AVATAR_TTL),
);

export const signVaultMedia = cache(
  async (paths: string[]): Promise<Map<string, string>> =>
    signBatch("vault-media", paths, MEDIA_TTL),
);

/**
 * Avatars can be an external URL (Google hands us one at sign-up) or a storage path.
 * Anything already absolute is passed through untouched.
 */
export function isExternal(url: string | null): boolean {
  return Boolean(url && /^https?:\/\//i.test(url));
}

/** Resolve a list of profiles' avatars in one batch. Returns id -> displayable URL. */
export async function resolveAvatars(
  profiles: Array<{ id: string; avatar_url: string | null }>,
): Promise<Map<string, string | null>> {
  const storagePaths = profiles
    .map((p) => p.avatar_url)
    .filter((url): url is string => Boolean(url) && !isExternal(url));

  const signed = await signAvatars(storagePaths);

  return new Map(
    profiles.map((p) => {
      if (!p.avatar_url) return [p.id, null];
      if (isExternal(p.avatar_url)) return [p.id, p.avatar_url];
      return [p.id, signed.get(p.avatar_url) ?? null];
    }),
  );
}
