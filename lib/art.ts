/**
 * Deterministic art direction from a string.
 *
 * ONE DAY posters, VAULT film plates and CREATE slips need to look individually
 * designed without anyone uploading anything. Everything here is derived from a hash
 * of the id or title, so a poster is the same poster on every device, every visit —
 * it is the idea's face, not decoration re-rolled on each render.
 */
export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small tilt in degrees, within ±max, never exactly zero-looking. */
export function tilt(seed: string, max = 2.2): number {
  const n = (hash(seed) % 1000) / 1000; // 0..1
  const value = (n * 2 - 1) * max;
  return Math.abs(value) < 0.4 ? (value < 0 ? -0.6 : 0.6) : Math.round(value * 10) / 10;
}

/**
 * Two-colour poster palettes drawn from the EXCLUSIVE world — midnight grounds lit by
 * the five room colours plus a couple of warm photographic tones, so the wall reads
 * as one print run rather than a random gradient generator.
 */
const PALETTES: Array<[string, string, string]> = [
  // [ground, light, ink]
  ["#101a3a", "#5be0ff", "#e8fbff"],
  ["#2a0f2b", "#ff5cc8", "#ffe6f6"],
  ["#1b1440", "#8f82ff", "#efeaff"],
  ["#2b170c", "#ffb35c", "#fff1e0"],
  ["#0d2622", "#5cffc4", "#e6fff6"],
  ["#2d0f16", "#ff6b6b", "#ffe8e8"],
  ["#161616", "#f4f1ff", "#f4f1ff"],
];

export function palette(seed: string): { ground: string; light: string; ink: string } {
  const [ground, light, ink] = PALETTES[hash(seed) % PALETTES.length];
  return { ground, light, ink };
}

/** Which physical format an idea is printed on. */
export function format<T extends string>(seed: string, formats: readonly T[]): T {
  return formats[hash(seed + ":f") % formats.length];
}

/** YouTube is the one reference host whose thumbnail is derivable without an API. */
export function referenceThumb(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "music.youtube.com") {
      id = u.searchParams.get("v") ?? (u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/)?.[2] ?? null);
    }
    return id && /^[\w-]{6,}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}
