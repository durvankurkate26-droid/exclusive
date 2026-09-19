"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { gsap } from "@/lib/animations/gsap";
import { chatFragments } from "@/lib/constants/landing";

const entryMasks = {
  "sweep-right": "inset(0 100% 0 0 round 1rem)",
  "sweep-left": "inset(0 0 0 100% round 1rem)",
  "sweep-up": "inset(100% 0 0 0 round 1rem)",
  iris: "circle(0% at 50% 50%)",
  depth: "inset(16% 24% round 1rem)",
} as const;

const openMasks = {
  "sweep-right": "inset(0 0% 0 0 round 1rem)",
  "sweep-left": "inset(0 0 0 0% round 1rem)",
  "sweep-up": "inset(0% 0 0 0 round 1rem)",
  iris: "circle(150% at 50% 50%)",
  depth: "inset(0% 0% round 1rem)",
} as const;

export function SocialChaosScene() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia();
    media.add(
      {
        motionAllowed: "(prefers-reduced-motion: no-preference)",
        mobileViewport: "(max-width: 640px)",
      },
      (mediaContext) => {
        const conditions = mediaContext.conditions as {
          motionAllowed: boolean;
          mobileViewport: boolean;
        };

        if (!conditions.motionAllowed) return;

        const context = gsap.context(() => {
          const cards = gsap.utils.toArray<HTMLElement>("[data-chaos-card]");
          const cardsLayer = section.querySelector<HTMLElement>("[data-chaos-cards]");
          const aperture = section.querySelector<HTMLElement>("[data-chaos-aperture]");
          const payoff = section.querySelector<HTMLElement>("[data-chaos-payoff]");
          const mobile = conditions.mobileViewport;
          const activeCards = cards.filter((card) => !mobile || card.dataset.mobile === "true");
          const inactiveCards = cards.filter((card) => mobile && card.dataset.mobile !== "true");

          const axisPosition = (card: HTMLElement, axis: "x" | "y") => {
            const key = mobile ? `m${axis}` : axis;
            const viewport = axis === "x" ? window.innerWidth : window.innerHeight;
            return (Number(card.dataset[key]) / 100) * viewport;
          };

          gsap.set(cards, {
            autoAlpha: 0,
            xPercent: -50,
            yPercent: -50,
            transformPerspective: mobile ? 650 : 900,
            transformOrigin: "50% 50%",
          });
          gsap.set(inactiveCards, { display: "none" });
          gsap.set(cardsLayer, { clipPath: "circle(150% at 50% 50%)" });
          gsap.set(payoff, {
            autoAlpha: 0,
            clipPath: "circle(0% at 50% 50%)",
            scale: 0.7,
            rotationX: 8,
            transformPerspective: 900,
          });

          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: () => `+=${Math.round(window.innerHeight * (mobile ? 1.9 : 2.25))}`,
              pin: true,
              scrub: 0.7,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          timeline.to("[data-chaos-label]", { autoAlpha: 1, duration: 0.1 }, 0);

          activeCards.forEach((card, index) => {
            const revealAt = Number(card.dataset.reveal);
            const rotation = Number(card.dataset.rotate);
            const driftRotation = Number(card.dataset.driftRotate);
            const depth = mobile ? Number(card.dataset.depth) * 0.45 : Number(card.dataset.depth);
            const mask = card.dataset.mask as keyof typeof entryMasks;

            timeline.fromTo(
              card,
              {
                x: () => axisPosition(card, "x") + Number(card.dataset.enterX),
                y: () => axisPosition(card, "y") + Number(card.dataset.enterY),
                rotation: rotation + (index % 2 === 0 ? -2 : 2),
                rotationX: mask === "depth" ? (index % 2 ? -11 : 11) : 0,
                rotationY: mask === "depth" ? (index % 2 ? 8 : -8) : 0,
                z: depth - (mask === "depth" ? 180 : 70),
                scale: Number(card.dataset.scale) - (mask === "iris" ? 0.14 : 0.08),
                clipPath: entryMasks[mask],
                autoAlpha: 0,
              },
              {
                x: () => axisPosition(card, "x"),
                y: () => axisPosition(card, "y"),
                rotation,
                rotationX: 0,
                rotationY: 0,
                z: depth,
                scale: Number(card.dataset.scale),
                clipPath: openMasks[mask],
                autoAlpha: Number(card.dataset.opacity),
                duration: mobile ? 0.12 : 0.14,
                ease: "power3.out",
                immediateRender: false,
              },
              revealAt,
            );

            timeline.to(
              card,
              {
                x: () => axisPosition(card, "x") + Number(card.dataset.driftX),
                y: () => axisPosition(card, "y") + Number(card.dataset.driftY),
                rotation: rotation + driftRotation,
                rotationX: index % 2 ? -1.6 : 1.4,
                rotationY: index % 3 ? 1.2 : -1.5,
                z: depth + (index % 2 ? -35 : 45),
                scale: Number(card.dataset.scale) + depth / 4200,
                duration: 0.16 + (index % 3) * 0.018,
                ease: "sine.inOut",
              },
              0.56 + (index % 3) * 0.012,
            );

            timeline.to(
              card,
              {
                x: () => (axisPosition(card, "x") + Number(card.dataset.driftX)) * 0.38,
                y: () => (axisPosition(card, "y") + Number(card.dataset.driftY)) * 0.38,
                rotation: rotation * 0.35,
                rotationX: 0,
                rotationY: 0,
                z: depth * 0.3,
                scale: Number(card.dataset.scale) * 0.78,
                duration: 0.14,
                ease: "power2.inOut",
              },
              0.75 + (index % 4) * 0.004,
            );

            timeline.to(
              card,
              {
                x: 0,
                y: 0,
                z: -420 - Math.abs(depth),
                rotation: 0,
                scale: 0.12,
                duration: 0.14,
                ease: "power3.in",
              },
              0.86 + (index % 3) * 0.004,
            );
          });

          timeline
            .to(
              "[data-chaos-label]",
              {
                y: -18,
                scale: 0.92,
                clipPath: "inset(0 50% 0 50%)",
                autoAlpha: 0,
                duration: 0.13,
                ease: "power2.in",
              },
              0.76,
            )
            .to(cardsLayer, { clipPath: "circle(0% at 50% 50%)", duration: 0.2, ease: "power3.inOut" }, 0.8)
            .fromTo(
              aperture,
              { autoAlpha: 0, scale: 0.15 },
              { autoAlpha: 1, scale: 1.25, duration: 0.14, ease: "power2.out" },
              0.78,
            )
            .to(aperture, { scale: 0.04, autoAlpha: 0, duration: 0.13, ease: "power3.in" }, 0.92)
            .to(
              payoff,
              {
                autoAlpha: 1,
                clipPath: "circle(145% at 50% 50%)",
                scale: 1,
                rotationX: 0,
                duration: 0.22,
                ease: "power3.out",
              },
              0.91,
            );
        }, section);

        return () => context.revert();
      },
    );

    return () => media.revert();
  }, []);

  return (
    <section ref={sectionRef} className="chaos-scene scene-screen" aria-labelledby="chaos-title">
      <div className="chaos-stage">
        <p data-chaos-label className="chaos-label">2:00AM · 400 UNREAD · THE CHAT NEVER SLEEPS</p>
        <div data-chaos-cards className="chaos-cards" aria-label="A rush of group chat fragments">
          {chatFragments.map((fragment) => (
            <p
              key={fragment.text}
              data-chaos-card
              data-x={fragment.x}
              data-y={fragment.y}
              data-mx={fragment.mx}
              data-my={fragment.my}
              data-enter-x={fragment.enterX}
              data-enter-y={fragment.enterY}
              data-drift-x={fragment.driftX}
              data-drift-y={fragment.driftY}
              data-drift-rotate={fragment.driftRotate}
              data-reveal={fragment.reveal}
              data-mask={fragment.mask}
              data-depth={fragment.depth}
              data-rotate={fragment.rotate}
              data-scale={fragment.scale}
              data-opacity={fragment.opacity}
              data-tone={fragment.tone}
              data-mobile={fragment.mobile}
              className="chaos-card"
              style={{
                "--chaos-x": `${fragment.x}vw`,
                "--chaos-y": `${fragment.y}vh`,
                "--chaos-mobile-x": `${fragment.mx}vw`,
                "--chaos-mobile-y": `${fragment.my}vh`,
                "--chaos-rotation": `${fragment.rotate}deg`,
                "--chaos-scale": fragment.scale,
                "--chaos-opacity": fragment.opacity,
              } as CSSProperties}
            >
              {fragment.text}
            </p>
          ))}
        </div>
        <div data-chaos-aperture className="chaos-aperture" aria-hidden="true" />
        <div data-chaos-payoff className="chaos-payoff">
          <p className="eyebrow text-[var(--pink)]">FROM THE NOISE →</p>
          <h2 id="chaos-title">EVERYTHING,<br /><span>FINALLY SORTED.</span></h2>
        </div>
      </div>
    </section>
  );
}
