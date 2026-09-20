import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  // Scroll choreography is measured, not eyeballed. Exposing the two globals in dev
  // makes every start/end/progress inspectable from the console (and from the browser
  // automation used to QA this page) without shipping anything to production.
  if (process.env.NODE_ENV !== "production") {
    Object.assign(window, { gsap, ScrollTrigger });
  }
}

export { gsap, ScrollTrigger };

/**
 * The scroll range of a pinned section's *tail*: the stretch that begins where the pin
 * releases and runs on while the section's own box clears the top of the screen.
 *
 * Two obvious spellings of this are both wrong.
 *
 * `start: "bottom bottom"` measures the pinned trigger's own box, which is one viewport
 * tall, so it resolves a few hundred pixels *into* the pin rather than after it -- the
 * chaos departure fade was firing at 1582 instead of 3379 and blanking the scene on
 * arrival. Measuring the pin-spacer instead does not work either: ScrollTrigger reverts
 * every spacer to its unpinned height for the duration of a refresh, precisely so that
 * positions are measured without pin spacing, so a spacer read during refresh is always
 * the short one.
 *
 * What is correct for this refresh pass is the pinned trigger's own `end`, which has the
 * pin distance baked into it. Reading it requires refreshing *after* the pin, which is
 * what `refreshPriority: -1` on the caller's trigger buys.
 */
export function pinnedTail(
  getPin: () => ScrollTrigger | undefined,
  leadVh = 0.02,
  spanVh = 0.4,
) {
  return {
    start: () => (getPin()?.end ?? 0) - window.innerHeight * leadVh,
    end: () => (getPin()?.end ?? 0) + window.innerHeight * spanVh,
  };
}
