"use client";

import { Fragment, useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/animations/gsap";
import { loopStations } from "@/lib/constants/landing";
import { Reveal } from "./Reveal";

/**
 * THE EXCLUSIVE LOOP.
 *
 * This section used to be five equal cards in a row with arrows between them: the one
 * place on the page that looked like every other product site. Five boxes also say the
 * wrong thing -- they read as five features, when the point is that it is one continuous
 * movement and each state is *caused* by the one before it.
 *
 * So the section is a single luminous thread with five stations hung off it, and one
 * charge that travels the thread as you scroll. A station does not fade in because it
 * entered the viewport; it lights because the charge reached it. Scroll back and it goes
 * out again.
 *
 * The charge is positioned from measured node centres rather than from an even 0/25/50/
 * 75/100 split, so it passes exactly through each node whatever the copy wraps to. Two
 * CSS variables carry the measurement; everything visual (the drawn thread, the spark,
 * the lit state) is CSS. There is one ScrollTrigger for the whole section.
 */
export function ConnectedJourney() {
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const nodes = gsap.utils.toArray<HTMLElement>("[data-node]", track);
      const stations = gsap.utils.toArray<HTMLElement>("[data-station]", track);
      if (!nodes.length) return;

      // Dim the stations only once the charge is definitely going to run. A failed or
      // blocked script then leaves the whole section readable rather than at 30%.
      track.dataset.armed = "true";

      /** Node centres relative to the track, remeasured on every refresh. */
      let centres: number[] = [];
      const measure = () => {
        const top = track.getBoundingClientRect().top;
        centres = nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return rect.top - top + rect.height / 2;
        });
        track.style.setProperty("--loop-a", `${centres[0]}px`);
        track.style.setProperty("--loop-b", `${centres[centres.length - 1]}px`);
      };

      const apply = (progress: number) => {
        if (!centres.length) return;
        const first = centres[0];
        const last = centres[centres.length - 1];
        const head = first + progress * (last - first);
        track.style.setProperty("--loop-len", `${head - first}px`);
        // A station lights a hair before the charge is level with it, which reads as the
        // energy arriving rather than as a checkbox being ticked behind it. The node and
        // its copy are separate grid children, so both carry the state.
        centres.forEach((centre, i) => {
          const lit = head >= centre - 10;
          for (const el of [nodes[i], stations[i]]) {
            if (lit) el?.setAttribute("data-lit", "");
            else el?.removeAttribute("data-lit");
          }
        });
      };

      const trigger = ScrollTrigger.create({
        trigger: track,
        start: "top 78%",
        end: "bottom 72%",
        scrub: 0.7,
        invalidateOnRefresh: true,
        onRefresh: (self) => {
          measure();
          apply(self.progress);
        },
        onUpdate: (self) => apply(self.progress),
      });

      return () => {
        trigger.kill();
        delete track.dataset.armed;
        [...nodes, ...stations].forEach((el) => el.removeAttribute("data-lit"));
      };
    });

    return () => media.revert();
  }, []);

  return (
    <section id="loop" className="loop-section" aria-labelledby="loop-title">
      <Reveal className="loop-heading">
        <p className="eyebrow text-[var(--pink)]">NOT 5 FEATURES · ONE LOOP</p>
        <h2 id="loop-title">
          EVERYTHING A GROUP DOES,
          <br />
          <span>START TO MEMORY.</span>
        </h2>
        <p>
          One thing happens to every idea your group has ever had: it gets said, it gets
          agreed to, it gets planned, it either happens or it doesn&apos;t — and then it
          gets forgotten. EXCLUSIVE keeps the whole run in one place.
        </p>
      </Reveal>

      <div ref={trackRef} className="loop-track">
        <i className="loop-rail" aria-hidden="true">
          <b className="loop-fill" />
        </i>
        <i className="loop-spark" aria-hidden="true" />

        {loopStations.map((station, index) => (
          <Fragment key={station.room}>
            <i
              data-node
              className="loop-node"
              data-accent={station.accent}
              style={{ gridRow: index + 1 }}
              aria-hidden="true"
            />
            <article
              data-station
              className="loop-station"
              data-accent={station.accent}
              data-side={index % 2 ? "right" : "left"}
              style={{ gridRow: index + 1 }}
            >
              <p className="loop-index">
                <b>{station.index}</b>
                {station.stage}
              </p>
              <p className="loop-said">{station.said}</p>
              <h3 className="loop-room">{station.room}</h3>
              <p className="loop-becomes">{station.becomes}</p>
            </article>
          </Fragment>
        ))}
      </div>

      <Reveal className="loop-return" delay={0.05}>
        <span aria-hidden="true">↺</span> AND THE MEMORY BECOMES THE NEXT “WE SHOULD
        TOTALLY DO THIS”
      </Reveal>
    </section>
  );
}
