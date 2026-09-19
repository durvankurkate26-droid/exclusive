"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/animations/gsap";
import { CursorImageTrail } from "@/components/ui/cursor-image-trail";

/**
 * Trail frames. Replace these eight files with real friend-group photos; they live at
 * `public/images/trail/`. Aspect ratios vary per slot so the trail never reads as a
 * uniform strip, and the panel background keeps a tile visible if a file is missing.
 *
 * Built at module scope on purpose: CursorImageTrail lists `items` in an effect
 * dependency, so a new array on every render would re-bind its listener on every spawn.
 */
const TRAIL_ITEMS = ["4 / 5", "1 / 1", "3 / 2", "4 / 5", "1 / 1", "3 / 4", "4 / 3", "1 / 1"].map(
  (aspectRatio, index) => {
    const name = String(index + 1).padStart(2, "0");
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={name}
        src={`/images/trail/trail-${name}.jpg`}
        alt=""
        decoding="async"
        className="rounded-2xl border border-white/10 shadow-[0_18px_50px_rgba(5,4,12,.55)]"
        style={{ aspectRatio, objectFit: "cover", background: "var(--panel)" }}
      />
    );
  },
);

/**
 * The trail is decorative, so it is not rendered at all on touch devices or under
 * reduced motion. Gating the mount rather than the effect means no listener is bound
 * and no nodes exist, instead of being bound and then ignored.
 */
const TRAIL_QUERY = "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)";

function useTrailEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(TRAIL_QUERY);
    const sync = () => setEnabled(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return enabled;
}

export function HeroScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const trailEnabled = useTrailEnabled();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=135%",
            pin: true,
            scrub: 0.65,
            anticipatePin: 1,
          },
        });

        timeline
          .to("[data-hero-meta]", { autoAlpha: 0, y: -12, duration: 0.22 }, 0)
          .to("[data-hero-title]", { yPercent: -9, scale: 1.045, duration: 0.55, ease: "none" }, 0)
          .to("[data-hero-enter]", { autoAlpha: 0, y: -12, duration: 0.2 }, 0.03)
          .to("[data-hero-cue]", { autoAlpha: 0, duration: 0.18 }, 0.03)
          .fromTo(
            "[data-hero-statement]",
            { autoAlpha: 0, y: "23vh" },
            { autoAlpha: 1, y: 0, duration: 0.36, ease: "power2.out" },
            0.28,
          )
          .to("[data-hero-title]", { autoAlpha: 0, duration: 0.2 }, 0.62)
          .to("[data-hero-statement]", { y: -18, duration: 0.2, ease: "none" }, 0.78);
      }, section);

      return () => context.revert();
    });

    return () => media.revert();
  }, []);

  return (
    <section ref={sectionRef} id="top" className="hero-scene scene-screen" aria-labelledby="hero-title">
      <div className="hero-aurora" aria-hidden="true" />
      {/* Sibling layer, not a wrapper, so the grid and every data-hero-* target stay put.
          `absolute inset-0` makes this box match the section the trail measures against,
          and `containerRef` binds the listener to the hero alone rather than to window. */}
      {trailEnabled && (
        <CursorImageTrail
          containerRef={sectionRef}
          items={TRAIL_ITEMS}
          itemSize={150}
          trailLength={5}
          spawnDistance={130}
          rotationRange={13}
          className="pointer-events-none absolute inset-0 z-[1]"
        />
      )}
      <p data-hero-meta className="hero-meta left-[7vw] top-[15vh]">
        03:41 AM<br />still awake, obviously
      </p>
      <p data-hero-meta className="hero-meta right-[7vw] top-[20vh] text-right">
        est. whenever<br />the chat began
      </p>

      <div className="relative z-10 text-center">
        <p data-hero-enter className="eyebrow mb-4 text-[var(--pink)]">↓ ENTER THE ROOM</p>
        <h1 id="hero-title" data-hero-title className="exclusive-wordmark">EXCLUSIVE</h1>
        <p data-hero-meta className="hero-footnote">
          ↳ your friend photos scroll through here <span>[drop-in later]</span>
        </p>
      </div>

      <div data-hero-statement className="hero-statement">
        <p>
          A private digital space for <em>everything beyond the group chat.</em>
        </p>
      </div>

      <div data-hero-cue className="scroll-cue" aria-hidden="true">
        <span>SCROLL</span>
        <i />
      </div>
    </section>
  );
}
