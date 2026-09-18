"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/animations/gsap";

export function HeroScene() {
  const sectionRef = useRef<HTMLElement>(null);

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
