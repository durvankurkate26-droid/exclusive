"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { gsap, pinnedTail } from "@/lib/animations/gsap";
import { chaosPhotos, chatFragments, type ChatFragment } from "@/lib/constants/landing";
import { Shot } from "./Shot";

/**
 * Scroll choreography for the Social Chaos scene.
 *
 * The timeline is authored on a normalised 0-1 clock and pinned with `scrub`, so every
 * position below reads directly as a scroll percentage:
 *
 *   0.00 - 0.16  entry         first fragments arrive from their own edges
 *   0.16 - 0.50  population    the field fills in on an uneven cadence
 *   0.50 - 0.66  peak chaos    depth-layered parallax drift, nothing else changes
 *   0.66 - 0.83  organisation  rotations straighten, scales converge, spread tightens
 *   0.81 - 0.94  iris          the field is pulled into a closing aperture
 *   0.87 - 1.00  payoff        the next beat opens from that same focal point
 *
 * Adjacent phases hand off without a gap and the slower layers (the ambient field push,
 * the glow, the label) span the seams, so there is no scroll position where nothing moves.
 * Positions are never allowed past 1.0, which keeps them equal to scroll percentage.
 */
const ENTRY_DURATION = {
  left: 0.13,
  right: 0.13,
  top: 0.115,
  bottom: 0.12,
  punch: 0.155,
  whisper: 0.175,
} as const;

const ENTRY_EASE = {
  left: "power4.out",
  right: "power4.out",
  top: "power2.out",
  bottom: "power2.out",
  punch: "expo.out",
  whisper: "sine.out",
} as const;

/** Clipped on the leading edge of the travel, so each reveal wipes the way it moves. */
const ENTRY_CLIP = {
  left: "inset(0 0 0 100% round 1.1rem)",
  right: "inset(0 100% 0 0 round 1.1rem)",
  top: "inset(100% 0 0 0 round 1.1rem)",
  bottom: "inset(0 0 100% 0 round 1.1rem)",
  punch: "circle(0% at 50% 50%)",
  whisper: "inset(0 0 82% 0 round 1.1rem)",
} as const;

const RESTING_CLIP = {
  left: "inset(0 0 0 0% round 1.1rem)",
  right: "inset(0 0% 0 0 round 1.1rem)",
  top: "inset(0% 0 0 0 round 1.1rem)",
  bottom: "inset(0 0 0% 0 round 1.1rem)",
  punch: "circle(145% at 50% 50%)",
  whisper: "inset(0 0 0% 0 round 1.1rem)",
} as const;

/** Where a fragment waits before it travels in, guaranteed outside the relevant edge. */
function entryOffset(fragment: ChatFragment, x: number, y: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  switch (fragment.enter) {
    case "left":
      return { x: -(vw * (0.5 + x / 100)) - 240, y: vh * 0.045, rotate: -11 };
    case "right":
      return { x: vw * (0.5 - x / 100) + 240, y: -vh * 0.045, rotate: 11 };
    case "top":
      return { x: vw * 0.02, y: -(vh * (0.5 + y / 100)) - 150, rotate: -7 };
    case "bottom":
      return { x: -vw * 0.02, y: vh * (0.5 - y / 100) + 150, rotate: 7 };
    case "punch":
      return { x: 0, y: vh * 0.03, rotate: 4 };
    default:
      return { x: 0, y: vh * 0.035, rotate: 3 };
  }
}

export function SocialChaosScene() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia();

    const build = (mobile: boolean) => {
      const context = gsap.context(() => {
        const stage = section.querySelector<HTMLElement>("[data-chaos-stage]");
        const field = section.querySelector<HTMLElement>("[data-chaos-field]");
        const aperture = section.querySelector<HTMLElement>("[data-chaos-aperture]");
        const glow = section.querySelector<HTMLElement>("[data-chaos-glow]");
        const label = section.querySelector<HTMLElement>("[data-chaos-label]");
        const payoff = section.querySelector<HTMLElement>("[data-chaos-payoff]");
        const cards = gsap.utils.toArray<HTMLElement>("[data-chaos-card]");
        const shots = gsap.utils.toArray<HTMLElement>("[data-chaos-photo]");

        // Hide the field only once the timeline is definitely taking over, so a failed or
        // disabled script leaves the composition on screen instead of a blank viewport.
        stage?.setAttribute("data-armed", "true");

        const live = chatFragments
          .map((fragment, index) => ({ fragment, card: cards[index] }))
          .filter(({ fragment, card }) => Boolean(card) && (!mobile || fragment.mobile));

        gsap.set(
          cards.filter((_, index) => mobile && !chatFragments[index].mobile),
          { display: "none" },
        );

        /**
         * The opening fragments arrive *before* the pin.
         *
         * Every fragment used to be authored inside the pinned timeline, so at pin
         * progress 0 -- the exact scroll position where this section takes the frame --
         * the viewport held one soft glow and nothing else. One notch of scroll into a
         * new scene with nothing on screen is the definition of a slide change.
         *
         * These two run on the approach band instead, so the pin inherits a field that
         * is already populated and the pinned timeline only ever adds to it.
         */
        const PREROLL = 3;

        const restScale = (fragment: ChatFragment) => (mobile ? fragment.mscale : fragment.scale);
        const restX = (fragment: ChatFragment) =>
          ((mobile ? fragment.mx : fragment.x) / 100) * window.innerWidth;
        const restY = (fragment: ChatFragment) =>
          ((mobile ? fragment.my : fragment.y) / 100) * window.innerHeight;
        // Far fragments sit back in z and read dimmer; near ones come forward and brighter.
        const restZ = (fragment: ChatFragment) => fragment.depth * (mobile ? 55 : 150);
        const restAlpha = (fragment: ChatFragment) =>
          fragment.weight === "whisper" ? 0.72 : fragment.weight === "echo" ? 0.88 : 1;

        gsap.set(cards, {
          xPercent: -50,
          yPercent: -50,
          x: 0,
          y: 0,
          z: 0,
          rotation: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          transformPerspective: mobile ? 760 : 1100,
          transformOrigin: "50% 50%",
          force3D: true,
          autoAlpha: 0,
        });
        gsap.set(field, { clipPath: "circle(145% at 50% 50%)", scale: 1, transformOrigin: "50% 50%" });
        gsap.set(aperture, { autoAlpha: 0, scale: 1.35 });
        gsap.set(glow, { autoAlpha: 0, scale: 0.6, transformOrigin: "50% 50%" });
        gsap.set(label, { y: 0, scale: 1, clipPath: "inset(0 0% 0 0%)" });
        gsap.set(payoff, {
          autoAlpha: 0,
          clipPath: "circle(0% at 50% 50%)",
          scale: 0.86,
          rotationX: 7,
          transformPerspective: 1000,
        });

        // APPROACH. The section used to scroll in completely dark -- every fragment is
        // autoAlpha 0 until the pin engages, so there was a full viewport of blank
        // scrolling and then the scene sprang to life the instant it pinned. That jump
        // is what reads as a page switch. This band runs while the section is still
        // travelling up, so the atmosphere and the label are already present by the
        // time the pin takes over and the pinned timeline starts from something.
        //
        // The stage as a whole rides the same band. Without it the vignette -- which is
        // near-opaque at its outer edge -- crept over the departing hero at full strength
        // and read as a dark bar sliding up the screen.
        const approach = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "top top",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        approach
          // The stage as a whole rides this band. Without it the vignette -- which is
          // near-opaque at its outer edge -- crept over the departing hero at full
          // strength and read as a dark bar sliding up the screen.
          .fromTo(stage, { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", duration: 0.42 }, 0)
          .fromTo(
            glow,
            { autoAlpha: 0, scale: 0.55 },
            { autoAlpha: mobile ? 0.5 : 0.7, scale: 1, ease: "none", duration: 1 },
            0,
          )
          .fromTo(label, { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", duration: 0.5 }, 0.26)
          // The ambient push used to live at the head of the pinned timeline, which
          // meant the field jumped from rest to 1.08 the instant the pin engaged. It
          // resolves across the approach now and the pin inherits it already settled.
          .fromTo(
            field,
            { scale: mobile ? 1.06 : 1.11, y: mobile ? 14 : 30 },
            { scale: 1, y: 0, ease: "none", duration: 1 },
            0,
          );

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${Math.round(window.innerHeight * (mobile ? 1.7 : 2.1))}`,
            pin: true,
            scrub: 0.65,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            // will-change is scoped to the pinned window rather than left on permanently.
            onToggle: ({ isActive }) => {
              if (isActive) stage?.setAttribute("data-chaos-live", "true");
              else stage?.removeAttribute("data-chaos-live");
            },
          },
        });

        live.forEach(({ fragment, card }, index) => {
          const preroll = index < PREROLL;
          const scale = restScale(fragment);
          // Recomputed per refresh rather than captured, so the entry offsets survive a
          // resize inside the same breakpoint.
          const from = () =>
            entryOffset(
              fragment,
              mobile ? fragment.mx : fragment.x,
              mobile ? fragment.my : fragment.y,
            );
          const tilt = from().rotate;
          const travel = mobile ? 0.55 : 1;
          const depthEntry = fragment.enter === "punch" ? -560 : -180 - Math.abs(fragment.depth) * 140;
          const entryDuration = ENTRY_DURATION[fragment.enter] * (mobile ? 0.85 : 1);
          // A fragment never drifts while it is still arriving, and never drifts into the
          // organisation beat: two tweens fighting over the same transform would snap.
          const peakAt = Math.max(0.5 + Math.abs(fragment.depth) * 0.03, fragment.at + entryDuration);
          const peakDuration = Math.max(0.06, 0.655 - peakAt);

          // --- entry: its own direction, easing, duration, depth and wipe per fragment ---
          // Pre-roll fragments land on the approach; everything else on the pin. The
          // later `to` tweens capture their start values lazily, on first render, so a
          // fragment placed by the approach is already at rest by the time the pinned
          // drift reads it -- no `set` and no double ownership.
          const host = preroll ? approach : timeline;
          const entryAt = preroll ? 0.46 + index * 0.16 : fragment.at;
          host.fromTo(
            card,
            {
              x: () => from().x * travel,
              y: () => from().y * travel,
              z: mobile ? depthEntry * 0.4 : depthEntry,
              rotation: fragment.rotate + tilt,
              rotationX: mobile ? 0 : tilt * -0.55,
              rotationY: mobile ? 0 : fragment.enter === "punch" ? 14 : tilt * 0.4,
              scale: scale * (fragment.enter === "punch" ? 0.58 : 0.86),
              clipPath: ENTRY_CLIP[fragment.enter],
              autoAlpha: 0,
            },
            {
              x: 0,
              y: 0,
              z: () => restZ(fragment),
              rotation: fragment.rotate,
              rotationX: 0,
              rotationY: 0,
              scale,
              clipPath: RESTING_CLIP[fragment.enter],
              autoAlpha: restAlpha(fragment),
              duration: preroll ? 0.3 : entryDuration,
              ease: ENTRY_EASE[fragment.enter],
              immediateRender: false,
            },
            entryAt,
          );

          // --- peak chaos: depth-layered parallax. Near layers drift further, and the
          // opposite way from far ones, so the field reads as space rather than a wall.
          const drift = fragment.depth * (mobile ? 12 : 34);
          timeline.to(
            card,
            {
              x: drift,
              y: -drift * 0.42,
              z: () => restZ(fragment) + fragment.depth * (mobile ? 18 : 55),
              rotation: fragment.rotate + fragment.depth * 1.3,
              scale: scale * (1 + fragment.depth * 0.018),
              duration: peakDuration,
              ease: "sine.inOut",
            },
            peakAt,
          );

          // --- organisation: rotations straighten, scale differences shrink, the spread
          // tightens to 42% and the depth field collapses. Chaos becoming order.
          timeline.to(
            card,
            {
              x: () => -restX(fragment) * 0.58,
              y: () => -restY(fragment) * 0.58,
              z: 0,
              rotation: fragment.rotate * 0.12,
              scale:
                fragment.weight === "hero"
                  ? scale * 0.88
                  : gsap.utils.interpolate(scale, 0.94, 0.75),
              autoAlpha: 0.94,
              duration: 0.15,
              ease: "power2.inOut",
            },
            0.665 + Math.abs(fragment.depth) * 0.012,
          );

          // --- convergence: the last of the spread collapses toward the focal point while
          // the iris closes over it. Fragments stay legible; the mask does the removing.
          timeline.to(
            card,
            {
              x: () => -restX(fragment) * 0.9,
              y: () => -restY(fragment) * 0.9,
              rotation: 0,
              scale: 0.82,
              duration: 0.11,
              ease: "power3.in",
            },
            0.83,
          );
        });

        // --- photographs. Secondary to the messages, so they move less and later: a
        // vertical wipe instead of a flight, a gentler drift, and during organisation
        // they are pulled in with the field. The thread photo is the exception -- it
        // travels to the focal point and grows slightly, so it is the last thing the
        // iris closes on and the first thing TEA opens with.
        chaosPhotos.forEach((shot, index) => {
          const el = shots[index];
          if (!el) return;
          if (mobile && !shot.mobile) {
            gsap.set(el, { display: "none" });
            return;
          }
          const px = () => ((mobile ? shot.x * 0.5 : shot.x) / 100) * window.innerWidth;
          const py = () => (shot.y / 100) * window.innerHeight;
          const rest = shot.role === "deep" ? 0.3 : shot.role === "mid" ? 0.82 : 1;
          gsap.set(el, { xPercent: -50, yPercent: -50, rotation: shot.rotate, force3D: true });

          timeline.fromTo(
            el,
            { autoAlpha: 0, clipPath: "inset(0% 0% 100% 0%)", y: () => window.innerHeight * 0.06, scale: 1.08 },
            {
              autoAlpha: rest,
              clipPath: "inset(0% 0% 0% 0%)",
              y: 0,
              scale: 1,
              duration: 0.14,
              ease: "power2.out",
              immediateRender: false,
            },
            shot.at,
          );
          const drift = shot.depth * (mobile ? 10 : 26);
          timeline.to(
            el,
            { x: drift, y: -drift * 0.5, rotation: shot.rotate + shot.depth * 1.1, duration: 0.15, ease: "sine.inOut" },
            0.51,
          );
          if (shot.role === "thread") {
            timeline
              .to(el, { x: () => -px(), y: () => -py(), rotation: 0, scale: 1.3, duration: 0.17, ease: "power2.inOut" }, 0.665)
              .to(el, { scale: 1.2, duration: 0.11, ease: "power3.in" }, 0.83);
          } else {
            timeline
              .to(el, { x: () => -px() * 0.58, y: () => -py() * 0.58, rotation: shot.rotate * 0.15, autoAlpha: rest * 0.7, duration: 0.15, ease: "power2.inOut" }, 0.665)
              .to(el, { x: () => -px() * 0.9, y: () => -py() * 0.9, scale: 0.8, duration: 0.11, ease: "power3.in" }, 0.83);
          }
        });

        // The label is squeezed out of frame as the organisation beat begins.
        timeline.fromTo(
          label,
          { autoAlpha: 1, y: 0, scale: 1, clipPath: "inset(0 0% 0 0%)" },
          {
            y: -20,
            scale: 0.94,
            clipPath: "inset(0 50% 0 50%)",
            autoAlpha: 0,
            duration: 0.17,
            ease: "none",
            immediateRender: false,
          },
          0.58,
        );

        // --- the iris: a visible aperture ring closing over the field, with the field's
        // own clip-path following it. This, not opacity, is the transition.
        timeline
          .to(aperture, { autoAlpha: 1, scale: 1, duration: 0.06, ease: "sine.out" }, 0.81)
          .to(field, { scale: 1.05, duration: 0.11, ease: "power2.in" }, 0.83)
          // The payoff lands on top of the closing field; the field steps back so the
          // headline is never fighting a pile of messages for the same pixels.
          .to(field, { opacity: 0.32, duration: 0.07, ease: "none" }, 0.8)
          .to(field, { clipPath: "circle(0% at 50% 50%)", duration: 0.11, ease: "power3.inOut" }, 0.83)
          .to(aperture, { scale: 0.02, duration: 0.11, ease: "power3.inOut" }, 0.83)
          .to(glow, { scale: 1.6, autoAlpha: 0, duration: 0.14, ease: "none" }, 0.86)
          .to(aperture, { autoAlpha: 0, duration: 0.04, ease: "none" }, 0.92);

        // --- payoff: opens from the exact point the iris closed on, overlapping the close
        // so there is never a blank frame between the two beats.
        timeline.to(
          payoff,
          {
            autoAlpha: 1,
            clipPath: "circle(150% at 50% 50%)",
            scale: 1,
            rotationX: 0,
            duration: 0.2,
            ease: "none",
          },
          0.76,
        );

        // Settle: the payoff keeps drifting after it has arrived, so the pin releases
        // into motion that is already going the way the page is about to scroll rather
        // than stopping dead one frame before the handoff.
        timeline.to(
          payoff,
          { y: () => -window.innerHeight * 0.05, duration: 0.04, ease: "none" },
          0.96,
        );

        // DEPARTURE. The pin releases one viewport before the next section owns the
        // frame, and that viewport used to be dead scroll: the payoff line slid off the
        // top and left a bare band behind it. ENTER THE ROOMS is pulled up over this
        // section by a negative margin now, and this is the other half of that handoff --
        // the scene dims and lifts out while the next one rises through it.
        //
        // `fromTo` with an explicit start and `immediateRender: false` makes this
        // independent of build order: it does not have to read whatever the approach
        // last left on the stage.
        gsap.fromTo(
          stage,
          { autoAlpha: 1, y: 0 },
          {
            autoAlpha: 0,
            y: () => -window.innerHeight * 0.07,
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger: section,
              ...pinnedTail(() => timeline.scrollTrigger),
              scrub: 0.6,
              invalidateOnRefresh: true,
              // Refreshed last. pinnedTail() reads the pin-spacer's height, and the spacer
              // only grows to the pin distance during the pinned trigger's own refresh --
              // at default priority this measured the un-pinned box and put the fade a
              // few hundred pixels into the scene instead of after it.
              refreshPriority: -1,
            },
          },
        );
      }, section);

      return () => context.revert();
    };

    media.add("(prefers-reduced-motion: no-preference) and (min-width: 641px)", () => build(false));
    media.add("(prefers-reduced-motion: no-preference) and (max-width: 640px)", () => build(true));

    return () => media.revert();
  }, []);

  return (
    <section ref={sectionRef} className="chaos-scene scene-screen" aria-labelledby="chaos-title">
      <div data-chaos-stage className="chaos-stage">
        <div data-chaos-glow className="chaos-glow" aria-hidden="true" />
        <p data-chaos-label className="chaos-label">2:00AM · 400 UNREAD · THE CHAT NEVER SLEEPS</p>
        <div data-chaos-field className="chaos-field">
        <div className="chaos-photos" aria-hidden="true">
          {chaosPhotos.map((shot) => (
            <Shot
              key={shot.id}
              id={shot.id}
              decorative
              data-chaos-photo
              data-role={shot.role}
              sizes={shot.role === "deep" ? "(max-width: 640px) 86vw, 40vw" : "(max-width: 640px) 26vw, 15vw"}
              className="chaos-photo"
              style={
                {
                  "--cp-x": `${shot.x}vw`,
                  "--cp-y": `${shot.y}vh`,
                  "--cp-mx": `${shot.x * 0.5}vw`,
                  "--cp-w": `${shot.w}vw`,
                  "--cp-mw": `${shot.role === "deep" ? 86 : shot.w * 2.4}vw`,
                  "--cp-r": `${shot.rotate}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <ul data-chaos-cards className="chaos-cards" aria-label="A rush of group chat fragments">
          {chatFragments.map((fragment) => (
            <li
              key={fragment.text}
              data-chaos-card
              data-tone={fragment.tone}
              data-weight={fragment.weight}
              className="chaos-card"
              style={
                {
                  "--chaos-x": `${fragment.x}vw`,
                  "--chaos-y": `${fragment.y}vh`,
                  "--chaos-mx": `${fragment.mx}vw`,
                  "--chaos-my": `${fragment.my}vh`,
                  "--chaos-rotate": `${fragment.rotate}deg`,
                  "--chaos-scale": fragment.scale,
                  "--chaos-mscale": fragment.mscale,
                } as CSSProperties
              }
            >
              {fragment.text}
            </li>
          ))}
        </ul>
        </div>
        <div data-chaos-aperture className="chaos-aperture" aria-hidden="true" />
        <div data-chaos-payoff className="chaos-payoff">
          <h2 id="chaos-title">EVERYTHING,<br /><span>FINALLY SORTED.</span></h2>
        </div>
      </div>
    </section>
  );
}
