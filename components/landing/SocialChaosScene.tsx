"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "@/lib/animations/gsap";
import { chatFragments } from "@/lib/constants/landing";

export function SocialChaosScene() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-chaos-card]");
        const mobile = window.matchMedia("(max-width: 640px)").matches;

        cards.forEach((card, index) => {
          const x = Number(card.dataset[mobile ? "mx" : "x"]);
          const y = Number(card.dataset[mobile ? "my" : "y"]);
          gsap.set(card, {
            x: `${x}vw`,
            y: `${y}vh`,
            rotation: Number(card.dataset.rotate),
            scale: index < 4 ? 0.92 : 0.7,
            autoAlpha: index < 4 ? 0.38 : 0,
          });
        });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: mobile ? "+=175%" : "+=220%",
            pin: true,
            scrub: 0.7,
            anticipatePin: 1,
          },
        });

        timeline
          .to("[data-chaos-label]", { autoAlpha: 1, duration: 0.1 }, 0)
          .to(cards, { autoAlpha: 1, scale: 1, duration: 0.12, stagger: 0.025, ease: "power2.out" }, 0.02)
          .to(cards, { x: "+=0.8vw", y: (index) => `${index % 2 ? -1.8 : 1.8}vh`, duration: 0.18, stagger: 0.008, ease: "sine.inOut" }, 0.3)
          .to(cards, { x: 0, y: 0, rotation: 0, scale: 0.74, autoAlpha: 0, duration: 0.32, stagger: 0.005, ease: "power3.inOut" }, 0.54)
          .to("[data-chaos-label]", { autoAlpha: 0, y: -10, duration: 0.12 }, 0.59)
          .fromTo("[data-chaos-payoff]", { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.22, ease: "power2.out" }, 0.74);
      }, section);

      return () => context.revert();
    });

    return () => media.revert();
  }, []);

  return (
    <section ref={sectionRef} className="chaos-scene scene-screen" aria-labelledby="chaos-title">
      <div className="chaos-stage">
        <p data-chaos-label className="chaos-label">2:00AM · 400 UNREAD · THE CHAT NEVER SLEEPS</p>
        <div className="chaos-cards" aria-label="A rush of group chat fragments">
          {chatFragments.map((fragment) => (
            <p
              key={fragment.text}
              data-chaos-card
              data-x={fragment.x}
              data-y={fragment.y}
              data-mx={fragment.mx}
              data-my={fragment.my}
              data-rotate={fragment.rotate}
              data-tone={fragment.tone}
              className="chaos-card"
            >
              {fragment.text}
            </p>
          ))}
        </div>
        <div data-chaos-payoff className="chaos-payoff">
          <p className="eyebrow text-[var(--pink)]">FROM THE NOISE →</p>
          <h2 id="chaos-title">EVERYTHING,<br /><span>FINALLY SORTED.</span></h2>
        </div>
      </div>
    </section>
  );
}
