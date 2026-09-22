"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "@/lib/animations/gsap";
import { CursorImageTrail } from "@/components/ui/cursor-image-trail";
import { heroStill, heroTrail, photos } from "@/lib/content/group-photos";
import { Shot } from "./Shot";

/**
 * Trail frames: the group's own photos, in the mixed order set by `heroTrail`.
 *
 * Width follows each photo's real shape (portrait narrower, landscape wider) so the
 * trail reads as a handful of prints rather than a strip of equal tiles, and the frame
 * treatment rotates through three finishes -- bare, a thin print border, a hard crop --
 * so no two neighbours share a radius. Files are the ~520px `sm` variants, preloaded
 * once the word has assembled, so the first spawn never waits on the network.
 *
 * Built at module scope on purpose: CursorImageTrail lists `items` in an effect
 * dependency, so a new array on every render would re-bind its listener on every spawn.
 */
const FINISH = ["trail-bare", "trail-print", "trail-crop"] as const;
const TRAIL_WIDTHS = heroTrail.map((id) => {
  const p = photos[id];
  return p.w >= p.h ? 196 : 138;
});
const TRAIL_ITEMS = heroTrail.map((id, index) => {
  const p = photos[id];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={id}
      src={p.sm}
      alt=""
      decoding="async"
      draggable={false}
      className={`trail-shot ${FINISH[index % FINISH.length]}`}
      style={{ aspectRatio: `${p.w} / ${p.h}` }}
    />
  );
});

/**
 * Entry ritual choreography for E X C L U S I V E.
 *
 * Each letter is authored, not generated: `x`/`y` are vw/vh offsets from its resting
 * place, `r` its entry roll, `s` the scale it grows from, and `z` the depth it comes
 * forward through. `at` is the beat it starts on, ordered centre-outward so the word
 * grows from its middle rather than sweeping left to right like a typewriter.
 *
 * `ease` differs per letter on purpose. U arrives through depth on a long expo, the
 * outer E's fly furthest and settle hardest, I simply drops. Identical easing across
 * nine letters is what makes a stagger read as a effect rather than as a composition.
 */
const LETTERS = [
  { ch: "E", x: -34, y: -24, r: -9, s: 0.74, z: -160, ry: 16, at: 0.30, d: 0.86, ease: "expo.out" },
  { ch: "X", x: -48, y: 7, r: 6, s: 0.7, z: -90, ry: -12, at: 0.245, d: 0.9, ease: "expo.out" },
  { ch: "C", x: -7, y: 31, r: -5, s: 0.82, z: -60, ry: 0, at: 0.19, d: 0.78, ease: "power4.out" },
  { ch: "L", x: 4, y: -37, r: 7, s: 0.78, z: -40, ry: 0, at: 0.135, d: 0.72, ease: "power4.out" },
  { ch: "U", x: 0, y: 0, r: 0, s: 0.36, z: -760, ry: 0, at: 0.08, d: 1.05, ease: "expo.out" },
  { ch: "S", x: 27, y: 28, r: 8, s: 0.72, z: -70, ry: -14, at: 0.135, d: 0.74, ease: "power4.out" },
  { ch: "I", x: 5, y: -44, r: -4, s: 0.88, z: 0, ry: 0, at: 0.19, d: 0.66, ease: "power3.out" },
  { ch: "V", x: 42, y: 5, r: -7, s: 0.71, z: -110, ry: 18, at: 0.245, d: 0.9, ease: "expo.out" },
  { ch: "E", x: 37, y: -21, r: 9, s: 0.76, z: -150, ry: -16, at: 0.30, d: 0.86, ease: "expo.out" },
];

const TRAIL_QUERY = "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)";

/** The trail is decorative: never mounted on touch or under reduced motion. */
function useTrailAllowed() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(TRAIL_QUERY);
    const sync = () => setAllowed(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return allowed;
}

export function HeroScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const [introDone, setIntroDone] = useState(false);
  // The hero is pinned, so a trail item spawned here does not scroll away with the
  // section -- it sits in the corner while the next scene arrives. The trail is armed
  // only while the word is still composed, and dropped the moment the door opens.
  const [heroHolding, setHeroHolding] = useState(true);
  const trailAllowed = useTrailAllowed();

  // Warm the trail's twelve small files off the critical path: on the first pointer move
  // over the hero, or when the browser goes idle, whichever comes first. Measured, this
  // took ~325KB out of the initial desktop load without the first spawn ever waiting.
  useEffect(() => {
    const section = sectionRef.current;
    if (!trailAllowed || !section) return;
    let done = false;
    const warm = () => {
      if (done) return;
      done = true;
      heroTrail.forEach((id) => {
        const img = new Image();
        img.decoding = "async";
        img.src = photos[id].sm ?? photos[id].src;
      });
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 4000 })
      : window.setTimeout(warm, 2500);
    section.addEventListener("pointermove", warm, { once: true, passive: true });
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      section.removeEventListener("pointermove", warm);
    };
  }, [trailAllowed]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia();

    media.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        wide: "(min-width: 1024px)",
        mid: "(min-width: 641px) and (max-width: 1023px)",
      },
      (ctx) => {
        const c = ctx.conditions as { motion: boolean; wide: boolean; mid: boolean };
        if (!c.motion) {
          setIntroDone(true);
          return;
        }
        // One travel multiplier drives every distance, so a breakpoint is a single number
        // rather than a second set of hand-tuned coordinates.
        const d = c.wide ? 1 : c.mid ? 0.62 : 0.4;
        const flat = !c.wide && !c.mid;

        const context = gsap.context((self) => {
          const letters = gsap.utils.toArray<HTMLElement>("[data-letter]");
          const vw = (n: number) => (n / 100) * window.innerWidth;
          const vh = (n: number) => (n / 100) * window.innerHeight;

          // ---------------------------------------------------------- ENTRY RITUAL
          // Plays on load, never on scroll. If the visitor arrives already scrolled
          // (a refresh mid-page, a restored position) the ritual is skipped and the
          // word is simply present -- an intro that replays under the fold is noise.
          const skip = window.scrollY > 40;

          // Resting state first. The scroll-exit timeline records whatever it finds as
          // each tween's start value, so it must be built against the finished word --
          // otherwise progress 0 pins the letters to the scattered pre-assembly state
          // and the handoff permanently fights the entrance.
          gsap.set(letters, { x: 0, y: 0, z: 0, rotation: 0, rotationY: 0, scale: 1, autoAlpha: 1 });
          gsap.set("[data-ghosts]", { autoAlpha: 0 });
          gsap.set("[data-micro]", { autoAlpha: 0, y: 10 });

          buildExit();

          const intro = gsap.timeline({
            defaults: { force3D: true },
            onComplete: () => setIntroDone(true),
          });

          if (skip) {
            gsap.set("[data-ghosts]", { autoAlpha: 1 });
            gsap.set("[data-micro]", { autoAlpha: 1, y: 0 });
            setIntroDone(true);
          } else {
            // 1. MICRO SIGNAL -- the system waking up before anything is drawn.
            intro.fromTo(
              "[data-hero-enter]",
              { autoAlpha: 0, letterSpacing: "1.4em", y: 8, filter: "blur(6px)" },
              {
                autoAlpha: 1,
                letterSpacing: "0.5em",
                y: 0,
                filter: "blur(0px)",
                duration: 0.72,
                ease: "expo.out",
              },
              0.12,
            );

            // 2. ASSEMBLY -- nine authored arrivals, centre-outward.
            LETTERS.forEach((L, i) => {
              intro.fromTo(
                letters[i],
                {
                  x: () => vw(L.x) * d,
                  y: () => vh(L.y) * d,
                  z: L.z * d,
                  rotation: L.r * d,
                  rotationY: flat ? 0 : L.ry * d,
                  scale: L.s,
                  autoAlpha: 0,
                },
                {
                  x: 0,
                  y: 0,
                  z: 0,
                  rotation: 0,
                  rotationY: 0,
                  scale: 1,
                  autoAlpha: 1,
                  duration: L.d,
                  ease: L.ease,
                },
                L.at,
              );
              // Slices converge on their own, slightly behind the letter body, so the
              // seam resolving is a separate readable beat rather than a by-product.
              intro.fromTo(
                letters[i].querySelectorAll("[data-slice]"),
                { xPercent: (s) => (s === 0 ? -9 : 9) * d, yPercent: (s) => (s === 0 ? -3 : 3) * d },
                { xPercent: 0, yPercent: 0, duration: L.d * 0.8, ease: "expo.out" },
                L.at + 0.06,
              );
            });

            // 3. LOCK -- a few pixels of compression, no overshoot. Components becoming
            // one word. The ghosts and the background light settle on the same beat.
            intro
              .fromTo(
                "[data-word]",
                { scale: 1.016, letterSpacing: "0.035em" },
                { scale: 1, letterSpacing: "0.01em", duration: 0.42, ease: "power3.inOut" },
                1.16,
              )
              .to("[data-ghosts]", { autoAlpha: 1, duration: 0.7, ease: "none" }, 1.0)
              .fromTo(
                "[data-hero-aurora]",
                { opacity: 0.45 },
                { opacity: 1, duration: 0.6, ease: "power2.out" },
                1.1,
              );

            // 4. LIGHT SWEEP -- one pass, left to right, driven by a per-letter variable
            // that the ::after highlight reads. Runs once; there is no idle loop.
            intro.to(
              letters,
              {
                keyframes: [
                  { "--sweep": 1, duration: 0.24, ease: "power2.out" },
                  { "--sweep": 0, duration: 0.34, ease: "power2.in" },
                ],
                stagger: { each: 0.045, from: "start" },
              },
              1.32,
            );

            // 5. AMBIENCE -- world-building metadata arrives last, quietly.
            intro.to(
              "[data-micro]",
              { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.07 },
              1.3,
            );

            // An impatient visitor must never out-run the ritual. Scrolling during the
            // intro finishes it immediately, which fires onComplete and builds the pin
            // before the hero can scroll away without one.
            const hurry = () => {
              window.removeEventListener("scroll", hurry);
              if (intro.progress() < 1) intro.progress(1, false);
            };
            window.addEventListener("scroll", hurry, { passive: true, once: true });
            self.add(() => () => window.removeEventListener("scroll", hurry));
          }

          // ------------------------------------------------------- SCROLL HANDOFF
          // The word does not fade: it parts. Letters drift toward the edge they are
          // nearest, the seams split back open, and the statement rises through the gap
          // that opens in the middle. ENTER THE ROOM, made literal.
          //
          // Built only once the ritual has finished. Created up front, a scrubbed
          // ScrollTrigger records whatever the letters look like at build time as its
          // baseline and re-applies it at progress 0 -- which, during the intro, is the
          // scattered pre-assembly state. The handoff then permanently fought the
          // entrance and the word never reached full opacity.
          function buildExit() {
          const exit = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "+=150%",
              pin: true,
              scrub: 0.65,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              // Photographs parked by the cursor must not outlive the word they belong to.
              onUpdate: (self) => setHeroHolding(self.progress < 0.12),
            },
          });

          exit
            .to("[data-hero-meta],[data-micro]", { autoAlpha: 0, y: -12, duration: 0.22 }, 0.02)
            .to("[data-hero-enter]", { autoAlpha: 0, y: -12, duration: 0.2 }, 0.04)
            .to("[data-hero-cue]", { autoAlpha: 0, duration: 0.16 }, 0.02)
            // Touch stills leave the way the letters will: toward their own edge.
            .to("[data-still]", {
              x: (i) => (i % 2 ? 1 : -1) * vw(9) * d,
              y: () => -vh(6),
              autoAlpha: 0,
              duration: 0.34,
              ease: "power1.in",
            }, 0.06);

          // A door swinging, not a word exploding.
          //
          // The endpoints below are close to what they were; what changed is *when* the
          // distance is spent. Tracking used to open from .01em to .09em across the first
          // 30% of the pin while the letters were already translating, so two spreads
          // compounded early and the word appeared to burst on the first scroll notch.
          //
          //   0.00-0.30  pressure. Tracking creeps .01em -> .032em; nothing else moves.
          //   0.30-0.60  the hinge opens. Outer letters lead, the centre gives way last.
          //   0.60-0.85  the statement rises through the gap the centre letter left.
          //   0.85-1.00  what is left of the word clears the frame.
          //
          // `power2.in` over a band starting at 0.16 buys that shape: about a fifth of
          // the travel is spent by 60%, and the rest of it in the final quarter.
          exit
            .fromTo(
              "[data-word]",
              { letterSpacing: "0.01em" },
              { letterSpacing: "0.032em", duration: 0.3, ease: "none" },
              0,
            )
            .to("[data-word]", { letterSpacing: "0.078em", duration: 0.56, ease: "power2.in" }, 0.3);

          LETTERS.forEach((L, i) => {
            const from = i - 4;
            const rank = Math.abs(from);                 // 0 centre .. 4 outermost
            const at = 0.16 + (4 - rank) * 0.025;        // outer letters go first
            const span = 0.9 - at;

            exit.to(
              letters[i],
              {
                x: () => vw(from * 6.4) * d,
                y: () => vh(rank * 1.2 - 1.6) * d,
                rotation: from * 0.9 * d,
                z: from === 0 ? -400 * d : -40 * d,
                autoAlpha: from === 0 ? 0 : 1,
                duration: span,
                ease: "power2.in",
              },
              at,
            );
            exit.to(
              letters[i].querySelectorAll("[data-slice]"),
              {
                xPercent: (s) => (s === 0 ? -11 : 11) * d,
                duration: span * 0.9,
                ease: "power1.in",
              },
              at + 0.08,
            );
          });

          exit
            // The doorway: a warm gap opens where the centre letter was.
            .fromTo(
              "[data-door]",
              { autoAlpha: 0, scaleX: 0.2, scaleY: 0.35 },
              { autoAlpha: 1, scaleX: 1, scaleY: 1, duration: 0.38, ease: "none" },
              0.42,
            )
            // The next beat arrives *through* the word rather than after it: the
            // statement is already legible while four letters are still on screen.
            .fromTo(
              "[data-hero-statement]",
              { autoAlpha: 0, y: "20vh" },
              { autoAlpha: 1, y: 0, duration: 0.27, ease: "none" },
              0.58,
            )
            .to("[data-ghosts]", { autoAlpha: 0.35, scale: 1.18, duration: 0.62, ease: "none" }, 0.24)
            // The statement rises *through* the parted word, which means for a quarter
            // of the pin the two share the frame. Measured at 90% of the pin, two
            // letters were covering a third of the sentence each. The word steps back
            // to 30% as the statement arrives -- letters leaving, sentence landing --
            // and the statement carries its own scrim (see .hero-statement::before).
            .to("[data-word]", { opacity: 0.3, duration: 0.26, ease: "none" }, 0.58)
            .to("[data-word]", { autoAlpha: 0, duration: 0.14, ease: "none" }, 0.86)
            .to("[data-door]", { autoAlpha: 0, scale: 1.6, duration: 0.16, ease: "none" }, 0.84)
            // The hero does not stop dead one frame before the handoff: the statement is
            // already drifting the way the page is about to move when the pin releases.
            .to("[data-hero-statement]", { y: "-7vh", duration: 0.14, ease: "none" }, 0.86);

            // Sections below were measured without the hero's pin-spacer, so their
            // triggers need re-measuring now that it exists.
          }

          // ------------------------------------------------- POINTER PROXIMITY
          // Desktop only, and only once the word is whole. One rAF-throttled variable
          // on the section; CSS multiplies it per depth layer, so there is no per-frame
          // bookkeeping and the letters never move far enough to hurt legibility.
          if (!c.wide) return;

          let frame = 0;
          let px = 0;
          let py = 0;
          const apply = () => {
            frame = 0;
            section.style.setProperty("--hx", px.toFixed(3));
            section.style.setProperty("--hy", py.toFixed(3));
          };
          const onMove = (e: PointerEvent) => {
            px = gsap.utils.clamp(-1, 1, (e.clientX / window.innerWidth) * 2 - 1);
            py = gsap.utils.clamp(-1, 1, (e.clientY / window.innerHeight) * 2 - 1);
            if (!frame) frame = requestAnimationFrame(apply);
          };
          const onLeave = () => {
            px = 0;
            py = 0;
            if (!frame) frame = requestAnimationFrame(apply);
          };
          section.addEventListener("pointermove", onMove, { passive: true });
          section.addEventListener("pointerleave", onLeave);

          return () => {
            if (frame) cancelAnimationFrame(frame);
            section.removeEventListener("pointermove", onMove);
            section.removeEventListener("pointerleave", onLeave);
          };
        }, section);

        return () => context.revert();
      },
    );

    return () => media.revert();
  }, []);

  return (
    <section ref={sectionRef} id="top" className="hero-scene scene-screen" aria-labelledby="hero-title">
      <div data-hero-aurora className="hero-aurora" aria-hidden="true" />

      {/* Depth, not decoration: three enormous cropped glyphs at 2-4% opacity that
          parallax slower than anything else. Meant to be felt, not read. */}
      <div data-ghosts className="hero-ghosts" aria-hidden="true">
        <span className="ghost ghost-e">E</span>
        <span className="ghost ghost-x">X</span>
        <span className="ghost ghost-v">V</span>
      </div>

      <p data-hero-meta className="hero-meta left-[7vw] top-[15vh]">
        03:41 AM<br />still awake, obviously
      </p>
      <p data-hero-meta className="hero-meta right-[7vw] top-[20vh] text-right">
        est. whenever<br />the chat began
      </p>
      <p data-micro className="hero-micro micro-left">09 MEMBERS</p>
      <p data-micro className="hero-micro micro-right">NO OUTSIDERS</p>

      <div className="relative z-10 text-center">
        <p data-hero-enter className="eyebrow mb-4 text-[var(--pink)]">↓ ENTER THE ROOM</p>
        <h1 id="hero-title" data-hero-title className="exclusive-wordmark">
          <span className="sr-only">EXCLUSIVE</span>
          {/* The doorway light sits behind the word and opens where U recedes. */}
          <span data-door className="hero-door" aria-hidden="true" />
          <span data-word className="ex-word" aria-hidden="true">
            {LETTERS.map((L, i) => (
              <span
                key={`${L.ch}-${i}`}
                data-letter
                data-char={L.ch}
                className="ex-letter"
                style={{ "--i": i } as React.CSSProperties}
              >
                <span data-slice className="ex-slice ex-slice-top">{L.ch}</span>
                <span data-slice className="ex-slice ex-slice-bottom">{L.ch}</span>
              </span>
            ))}
          </span>
        </h1>
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

      {/* Touch and reduced-motion get a composed still life instead of the trail: four
          prints parked above and below the word, never across it. CSS decides whether
          they show, so desktop never downloads them (lazy + display:none). */}
      <div className="hero-stills" aria-hidden="true">
        {heroStill.map((id, i) => (
          <Shot key={id} id={id} data-still decorative sizes="46vw" className={`hero-still still-${i + 1}`} />
        ))}
      </div>

      {/* Mounted once and left mounted. Toggling this node's existence mid-scroll made
          React insert into a section ScrollTrigger had already re-parented into its
          pin-spacer, which threw NotFoundError and killed the whole effect. The intro
          gate is a prop instead: an impossible spawn distance until the word is whole,
          which re-runs the trail's own effect without touching the DOM tree. */}
      {trailAllowed && (
        <CursorImageTrail
          containerRef={sectionRef}
          items={TRAIL_ITEMS}
          itemWidths={TRAIL_WIDTHS}
          scaleRange={0.08}
          trailLength={5}
          enabled={introDone && heroHolding}
          spawnDistance={140}
          rotationRange={9}
          className="pointer-events-none absolute inset-0 z-[2]"
        />
      )}
    </section>
  );
}
