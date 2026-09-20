export type Accent = "pink" | "violet" | "cyan";

export const rooms: Array<{
  number: string;
  name: string;
  description: string;
  accent: Accent;
}> = [
  { number: "01", name: "TEA", description: "the group chat's group chat. spill zone — screenshots stay in the room.", accent: "pink" },
  { number: "02", name: "CREATE", description: "that reel we keep not making. plan it, shoot it, ship it — together.", accent: "violet" },
  { number: "03", name: "ONE DAY", description: "Goa. eventually. a home for the someday-plans so they stop dying in the chat.", accent: "cyan" },
  { number: "04", name: "ALIGN", description: "who's actually free Saturday. one tap, everyone's availability, no more polls.", accent: "pink" },
  { number: "05", name: "VAULT", description: "the photos — the good ones. every memory in one place, only for the people who were there.", accent: "violet" },
];

/**
 * The Social Chaos field.
 *
 * `x`/`y` are offsets from the centre of the viewport in vw/vh (mobile: `mx`/`my`).
 * They are written to CSS custom properties and resolved by `left`/`top` in CSS, so the
 * composition exists without JavaScript. GSAP then animates transforms *relative* to
 * that resting anchor, which keeps the scene resize-proof and gives reduced-motion and
 * no-JS users the real art direction instead of a wrapped row of pills.
 *
 * `weight` drives the visual tier (type size, border, brightness), `depth` drives
 * parallax direction and amount at peak chaos, `enter` picks the reveal behaviour,
 * and `at` is the scroll progress (0-1) the fragment lands on.
 */
export type ChatFragment = {
  text: string;
  x: number;
  y: number;
  mx: number;
  my: number;
  rotate: number;
  scale: number;
  mscale: number;
  depth: number;
  tone: Accent | "muted" | "loud";
  weight: "hero" | "lead" | "echo" | "whisper";
  enter: "left" | "right" | "top" | "bottom" | "punch" | "whisper";
  at: number;
  mobile: boolean;
};

export const chatFragments: ChatFragment[] = [
  // upper-left, first thing on screen
  { text: "Goa plan kab actual hoga \u{1F62D}", x: -36, y: -30, mx: -17, my: -20, rotate: -5, scale: 1.02, mscale: 0.96, depth: 0.7, tone: "pink", weight: "lead", enter: "left", at: 0, mobile: true },
  // lower-left, enters almost immediately so the scene is never empty
  { text: "kal ka scene kya hai?", x: -22, y: 31, mx: 14, my: 24, rotate: 6, scale: 0.95, mscale: 0.84, depth: 0.35, tone: "cyan", weight: "lead", enter: "bottom", at: 0.045, mobile: true },
  // upper-right
  { text: "who's free this Saturday?", x: 29, y: -35, mx: 20, my: -6, rotate: 4.5, scale: 0.92, mscale: 0.86, depth: -0.2, tone: "cyan", weight: "lead", enter: "top", at: 0.105, mobile: true },
  // far-left, deliberately clipped by the viewport edge
  { text: "bhai photos bhej na", x: -54, y: -5, mx: -24, my: -34, rotate: 3, scale: 0.88, mscale: 0.78, depth: -0.55, tone: "violet", weight: "echo", enter: "left", at: 0.14, mobile: false },
  // small fragment riding the top edge
  { text: "Saturday pakka na?", x: -8, y: -27, mx: -6, my: -34, rotate: -2, scale: 0.74, mscale: 0.76, depth: -0.8, tone: "violet", weight: "whisper", enter: "whisper", at: 0.155, mobile: true },
  // the dominant message: mid-right, forward in z, punches through
  { text: "WE HAVE TO MAKE THIS REEL", x: 23, y: 7, mx: -6, my: 6, rotate: -3, scale: 1.24, mscale: 1.02, depth: 1, tone: "loud", weight: "hero", enter: "punch", at: 0.225, mobile: true },
  // lower-right
  { text: "tea after lecture???", x: 18, y: 34, mx: -16, my: 34, rotate: -6.5, scale: 0.9, mscale: 0.88, depth: 0.5, tone: "pink", weight: "lead", enter: "bottom", at: 0.265, mobile: true },
  // low-centre, wide, fills the bottom of the frame
  { text: "send the good pics, not the ugly ones \u{1F62D}", x: 5, y: 16, mx: 0, my: 0, rotate: -4, scale: 0.86, mscale: 0.7, depth: 0.15, tone: "pink", weight: "echo", enter: "bottom", at: 0.285, mobile: false },
  // lower-right outer band
  { text: "yeh plan fir cancel mat karna", x: 44, y: 26, mx: 0, my: 0, rotate: 5.5, scale: 0.82, mscale: 0.72, depth: -0.4, tone: "muted", weight: "echo", enter: "right", at: 0.325, mobile: false },
  // lower-left outer band, partly clipped
  { text: "Prisha ko koi convince karo", x: -49, y: 27, mx: 0, my: 0, rotate: -6, scale: 0.8, mscale: 0.72, depth: -0.65, tone: "muted", weight: "echo", enter: "left", at: 0.355, mobile: false },
  // far-right, clipped, background chatter
  { text: "bro who invited him \u{1F480}", x: 53, y: -23, mx: 0, my: 0, rotate: 8, scale: 0.76, mscale: 0.7, depth: -0.9, tone: "muted", weight: "whisper", enter: "right", at: 0.39, mobile: false },
  // floating near centre-left, the last thing to arrive
  { text: "5 min mein aa raha hu", x: -18, y: 8, mx: 0, my: 0, rotate: -7, scale: 0.7, mscale: 0.68, depth: -0.3, tone: "muted", weight: "whisper", enter: "whisper", at: 0.405, mobile: false },
];

export const journeySteps = [
  { label: "STEP 01 · IDEA", room: "TEA", copy: "\"bhai we should totally do this\" — the spark, before it dies in the scroll.", accent: "cyan" },
  { label: "STEP 02 · INTEREST", room: "ONE DAY", copy: "Everyone taps \"I'm in.\" Enough hands and it graduates to a real plan.", accent: "cyan" },
  { label: "STEP 03 · PLAN", room: "ALIGN", copy: "Date, place, budget between 9 people — locked without the 200-message chaos.", accent: "pink" },
  { label: "STEP 04 · CREATE", room: "CREATE", copy: "You actually go, you actually shoot the reel. The thing gets made.", accent: "violet" },
  { label: "STEP 05 · MEMORY", room: "VAULT", copy: "Photos, clips, quotes — one Memory Capsule, only for the people who were there.", accent: "pink" },
] as const;
