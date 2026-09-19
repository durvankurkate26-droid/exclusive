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

export const chatFragments = [
  { text: "Goa plan kab actual hoga 😭", x: -34, y: -26, mx: -21, my: -27, enterX: -130, enterY: -38, driftX: 18, driftY: -9, driftRotate: 1.4, reveal: 0, mask: "sweep-right", depth: 90, rotate: -6, scale: 0.98, opacity: 1, tone: "pink", mobile: true },
  { text: "who's free this Saturday?", x: 30, y: -30, mx: 20, my: -19, enterX: 125, enterY: -52, driftX: -14, driftY: 12, driftRotate: -1.2, reveal: 0.07, mask: "iris", depth: -70, rotate: 5, scale: 0.96, opacity: 1, tone: "cyan", mobile: true },
  { text: "bhai photos bhej na", x: -40, y: 8, mx: -23, my: -6, enterX: -145, enterY: 18, driftX: 22, driftY: 5, driftRotate: -1, reveal: 0.13, mask: "sweep-left", depth: 45, rotate: 3, scale: 1, opacity: 1, tone: "violet", mobile: true },
  { text: "WE HAVE TO MAKE THIS REEL", x: 36, y: 14, mx: 17, my: 7, enterX: 150, enterY: 35, driftX: -20, driftY: -8, driftRotate: 1.2, reveal: 0.18, mask: "depth", depth: 130, rotate: -4, scale: 1.04, opacity: 1, tone: "loud", mobile: true },
  { text: "kal ka scene kya hai?", x: -20, y: 30, mx: -18, my: 23, enterX: -95, enterY: 100, driftX: 12, driftY: -14, driftRotate: -1.5, reveal: 0.23, mask: "sweep-up", depth: -95, rotate: 6, scale: 0.97, opacity: 0.96, tone: "cyan", mobile: true },
  { text: "tea after lecture???", x: 22, y: 32, mx: 16, my: 31, enterX: 100, enterY: 92, driftX: -10, driftY: -12, driftRotate: 1.5, reveal: 0.28, mask: "iris", depth: 70, rotate: -7, scale: 0.97, opacity: 0.98, tone: "pink", mobile: true },
  { text: "bro who invited him 💀", x: -48, y: -6, mx: -28, my: -14, enterX: -160, enterY: -12, driftX: 30, driftY: 10, driftRotate: -1.8, reveal: 0.33, mask: "depth", depth: -140, rotate: 6, scale: 0.92, opacity: 0.78, tone: "muted", mobile: false },
  { text: "5 min mein aa raha hu", x: 44, y: -8, mx: 27, my: -4, enterX: 160, enterY: -24, driftX: -26, driftY: 8, driftRotate: 1.1, reveal: 0.36, mask: "sweep-left", depth: 55, rotate: -3, scale: 0.94, opacity: 0.8, tone: "muted", mobile: false },
  { text: "Saturday pakka na?", x: 6, y: -35, mx: -2, my: -36, enterX: 18, enterY: -118, driftX: 11, driftY: 15, driftRotate: -1.3, reveal: 0.39, mask: "sweep-up", depth: -55, rotate: 4, scale: 0.94, opacity: 0.92, tone: "violet", mobile: true },
  { text: "send the good pics, not the ugly ones 😭", x: -8, y: 38, mx: 1, my: 40, enterX: -22, enterY: 125, driftX: -14, driftY: -15, driftRotate: 1.4, reveal: 0.42, mask: "depth", depth: 105, rotate: -5, scale: 0.91, opacity: 0.88, tone: "pink", mobile: true },
  { text: "yeh plan fir cancel mat karna", x: 50, y: 24, mx: 27, my: 21, enterX: 170, enterY: 80, driftX: -34, driftY: -9, driftRotate: -1.5, reveal: 0.45, mask: "sweep-right", depth: -115, rotate: 6, scale: 0.9, opacity: 0.72, tone: "muted", mobile: false },
  { text: "Prisha ko koi convince karo", x: -52, y: 26, mx: -27, my: 18, enterX: -175, enterY: 72, driftX: 36, driftY: -8, driftRotate: 1.8, reveal: 0.48, mask: "iris", depth: 35, rotate: -6, scale: 0.9, opacity: 0.72, tone: "muted", mobile: false },
] as const;

export const journeySteps = [
  { label: "STEP 01 · IDEA", room: "TEA", copy: "\"bhai we should totally do this\" — the spark, before it dies in the scroll.", accent: "cyan" },
  { label: "STEP 02 · INTEREST", room: "ONE DAY", copy: "Everyone taps \"I'm in.\" Enough hands and it graduates to a real plan.", accent: "cyan" },
  { label: "STEP 03 · PLAN", room: "ALIGN", copy: "Date, place, budget between 9 people — locked without the 200-message chaos.", accent: "pink" },
  { label: "STEP 04 · CREATE", room: "CREATE", copy: "You actually go, you actually shoot the reel. The thing gets made.", accent: "violet" },
  { label: "STEP 05 · MEMORY", room: "VAULT", copy: "Photos, clips, quotes — one Memory Capsule, only for the people who were there.", accent: "pink" },
] as const;
