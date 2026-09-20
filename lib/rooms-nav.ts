/**
 * Room navigation registry.
 *
 * The five rooms are not five sections: they are five labelled moments inside one
 * pinned, scrubbed ScrollTrigger. An `href="#tea"` therefore has nothing to point at --
 * the TEA state exists only at one scroll offset inside the pin, and jumping to the
 * section element lands on the *start* of the pin every time, which is why every menu
 * item used to go to the same place.
 *
 * ModulesScene publishes a resolver here when it builds its timeline, and withdraws it
 * on cleanup. The resolver is asked for a scroll position at click time rather than
 * handing out cached numbers, so a resize, a font swap or a ScrollTrigger.refresh()
 * between opening the menu and clicking an item cannot produce a stale target.
 */
export type RoomTarget = { top: number };

type Resolver = (roomName: string) => RoomTarget | null;

let resolve: Resolver | null = null;

export function registerRoomTargets(resolver: Resolver) {
  resolve = resolver;
  return () => {
    if (resolve === resolver) resolve = null;
  };
}

/**
 * Scroll position for a room, or `null` when the pinned story is not the active build
 * (mobile stacks the scenes; reduced motion removes the timeline entirely). Callers
 * fall back to the room's own element in that case.
 */
export function roomScrollTarget(roomName: string): number | null {
  const target = resolve?.(roomName) ?? null;
  if (!target) return null;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.max(0, Math.min(max, Math.round(target.top)));
}

/** Fallback for the stacked / reduced-motion builds: the scene element itself. */
export function roomElementTarget(index: number): number | null {
  const scenes = document.querySelectorAll<HTMLElement>("[data-scene]");
  const scene = scenes[index];
  if (!scene) return null;
  const rect = scene.getBoundingClientRect();
  // Scenes in the stacked build carry their own top padding for the fixed navbar, so
  // the raw top is the right landing point rather than an arbitrary offset.
  return Math.max(0, Math.round(rect.top + window.scrollY));
}
