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
  { text: "Goa plan kab actual hoga 😭", x: -33, y: -26, mx: -23, my: -29, rotate: -6, tone: "pink", early: true },
  { text: "who's free this Saturday?", x: 30, y: -30, mx: 20, my: -19, rotate: 5, tone: "cyan", early: true },
  { text: "bhai photos bhej na", x: -39, y: 7, mx: -23, my: -5, rotate: 3, tone: "violet", early: true },
  { text: "WE HAVE TO MAKE THIS REEL", x: 35, y: 14, mx: 18, my: 10, rotate: -4, tone: "loud", early: true },
  { text: "kal ka scene kya hai?", x: -20, y: 30, mx: -18, my: 29, rotate: 6, tone: "cyan" },
  { text: "tea after lecture???", x: 22, y: 32, mx: 17, my: 34, rotate: -7, tone: "pink" },
  { text: "bro who invited him 💀", x: -46, y: -7, mx: -29, my: -16, rotate: 8, tone: "muted" },
  { text: "5 min mein aa raha hu", x: 43, y: -8, mx: 27, my: -3, rotate: -3, tone: "muted" },
  { text: "Saturday pakka na?", x: 6, y: -35, mx: -2, my: -38, rotate: 4, tone: "violet" },
  { text: "send the good pics, not the ugly ones 😭", x: -8, y: 38, mx: 4, my: 42, rotate: -5, tone: "pink" },
  { text: "yeh plan fir cancel mat karna", x: 49, y: 25, mx: 28, my: 23, rotate: 6, tone: "muted" },
  { text: "Prisha ko koi convince karo", x: -49, y: 26, mx: -28, my: 18, rotate: -8, tone: "muted" },
] as const;

export const journeySteps = [
  { label: "STEP 01 · IDEA", room: "TEA", copy: "\"bhai we should totally do this\" — the spark, before it dies in the scroll.", accent: "cyan" },
  { label: "STEP 02 · INTEREST", room: "ONE DAY", copy: "Everyone taps \"I'm in.\" Enough hands and it graduates to a real plan.", accent: "cyan" },
  { label: "STEP 03 · PLAN", room: "ALIGN", copy: "Date, place, budget between 9 people — locked without the 200-message chaos.", accent: "pink" },
  { label: "STEP 04 · CREATE", room: "CREATE", copy: "You actually go, you actually shoot the reel. The thing gets made.", accent: "violet" },
  { label: "STEP 05 · MEMORY", room: "VAULT", copy: "Photos, clips, quotes — one Memory Capsule, only for the people who were there.", accent: "pink" },
] as const;
