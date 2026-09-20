/**
 * The five rooms, in story order.
 *
 * One list, used by the desktop nav, the mobile dock, the Home hierarchy and the room
 * headers — so a room cannot be renamed in one place and stale in another. `accent`
 * is a CSS custom property name, not a colour: the shell writes it to `--room` and
 * everything downstream (nav underline, ambient wash, room header rule) reads that,
 * which is what keeps five rooms inside one visual family instead of five themes.
 */
export type RoomKey = "home" | "tea" | "create" | "one-day" | "align" | "vault";

export type Room = {
  key: RoomKey;
  /** URL segment under /g/[slug]. Home is the group root, so its segment is "". */
  segment: string;
  label: string;
  /** Two-letter mark for the mobile dock, where there is no room for a word. */
  mark: string;
  accent: string;
  /** Shown in the room header. Says what the room is *for*, not what it contains. */
  tagline: string;
  /** Used by every empty state in that room. */
  empty: { line: string; hint: string };
};

export const ROOMS: Room[] = [
  {
    key: "home",
    segment: "",
    label: "HOME",
    mark: "HM",
    accent: "var(--violet)",
    tagline: "What's happening with us right now.",
    empty: { line: "Quiet in here.", hint: "Start something in any room." },
  },
  {
    key: "tea",
    segment: "tea",
    label: "TEA",
    mark: "TE",
    accent: "var(--pink)",
    tagline: "The group chat's group chat.",
    empty: { line: "No tea yet.", hint: "Suspiciously peaceful." },
  },
  {
    key: "create",
    segment: "create",
    label: "CREATE",
    mark: "CR",
    accent: "var(--violet)",
    tagline: "The thing you keep saying you'll make.",
    empty: { line: "Nothing in the studio.", hint: "Someone needs to send a reel." },
  },
  {
    key: "one-day",
    segment: "one-day",
    label: "ONE DAY",
    mark: "OD",
    accent: "var(--cyan)",
    tagline: "Someday, but written down.",
    empty: { line: "No future bad decisions yet.", hint: "Put one in." },
  },
  {
    key: "align",
    segment: "align",
    label: "ALIGN",
    mark: "AL",
    accent: "var(--pink)",
    tagline: "What's still stopping this.",
    empty: { line: "Nothing to figure out.", hint: "For once." },
  },
  {
    key: "vault",
    segment: "vault",
    label: "VAULT",
    mark: "VA",
    accent: "#b9a7ff",
    tagline: "The reason any of it mattered.",
    empty: { line: "Nothing here yet.", hint: "Go make a memory." },
  },
];

export const ROOM_BY_KEY = Object.fromEntries(
  ROOMS.map((room) => [room.key, room]),
) as Record<RoomKey, Room>;

export function roomHref(slug: string, room: Room) {
  return room.segment ? `/g/${slug}/${room.segment}` : `/g/${slug}`;
}

/** Which room a pathname is in. Used for nav highlighting and the ambient tint. */
export function roomFromPath(pathname: string, slug: string): RoomKey {
  const base = `/g/${slug}`;
  if (pathname === base || pathname === `${base}/`) return "home";
  const rest = pathname.slice(base.length + 1).split("/")[0];
  const match = ROOMS.find((room) => room.segment && room.segment === rest);
  return match?.key ?? "home";
}
