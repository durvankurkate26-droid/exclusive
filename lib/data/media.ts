import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/session";

/**
 * Signed URLs for private buckets.
 *
 * Both buckets are private, so nothing can be rendered by path alone — every image
 * needs a short-lived signed URL minted after Supabase has checked the storage policy.
 *
 * Two costs are avoided here:
 *
 *  - Round trips. `createSignedUrls` (plural) signs a whole page's worth of paths in
 *    one request instead of one per avatar.
 *  - Re-downloads. A signature embeds its own issue time, so re-signing on every
 *    render hands the browser a *new URL* for the same photo on every navigation and
 *    its HTTP cache never hits. Signatures are therefore remembered per user for most
 *    of their lifetime, which keeps URLs stable (cached images) and skips the signing
 *    request entirely on repeat visits.
 *
 * The memo is keyed by user id: a URL is only ever reused for the same person whose
 * session Storage already authorised it for, so this never widens who can see what.
 */

const TTL = 60 * 60; // seconds a signature is valid for
const REUSE_FOR = 45 * 60 * 1000; // ms we hand out the same one — always ≥15 min of life left

type Memo = { url: string; at: number };
const memo = new Map<string, Memo>();

function prune(now: number) {
  if (memo.size < 5000) return;
  for (const [key, entry] of memo) if (now - entry.at > REUSE_FOR) memo.delete(key);
}

async function signBatch(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;

  const user = await getUser();
  if (!user) return out;
  const now = Date.now();
  const keyOf = (path: string) => `${user.id}|${bucket}|${path}`;

  const missing: string[] = [];
  for (const path of unique) {
    const hit = memo.get(keyOf(path));
    if (hit && now - hit.at < REUSE_FOR) out.set(path, hit.url);
    else missing.push(path);
  }
  if (missing.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, TTL);
  if (error || !data) {
    console.error(`[media] signing ${missing.length} ${bucket} paths failed:`, error?.message);
    return out;
  }

  prune(now);
  for (const row of data) {
    // A path the caller is not allowed to read comes back with an error and no URL;
    // leaving it out of the map makes the UI fall back to initials rather than a
    // broken image, which is the right failure for a privacy boundary.
    if (row.signedUrl && row.path) {
      out.set(row.path, row.signedUrl);
      memo.set(keyOf(row.path), { url: row.signedUrl, at: now });
    }
  }
  return out;
}

export const signAvatars = (paths: string[]) => signBatch("avatars", paths);
export const signVaultMedia = (paths: string[]) => signBatch("vault-media", paths);

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
