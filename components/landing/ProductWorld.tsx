"use client";

import { useEffect, useRef } from "react";
import { Shot } from "./Shot";

/**
 * A ROOM THAT ONLY MAKES SENSE IF YOU WERE THERE.
 *
 * This used to be a six-column bento of bordered cards, each holding a miniature UI
 * mockup -- the one section on the page that could have shipped unchanged on any SaaS
 * site, and the chat inside SPILL, SAFELY was too small and too low-contrast to read.
 *
 * Now it is one composition of five vignettes, each a different size and shape, with
 * no containers: type and an object, sitting in shared negative space. Every vignette
 * does exactly one thing when it comes into view (a message spills, frames fan out, a
 * postcard rises, labels snap, a stack spreads) and then holds still. On a fine pointer
 * the stack and the fan also answer hover. Reduced motion sees the finished state.
 */
export function ProductWorld() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>("[data-vignette]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.setAttribute("data-on", ""));
      return;
    }
    // Arm only once the observer exists, so a failed script shows finished states.
    root.setAttribute("data-armed", "");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-on", "");
            io.unobserve(entry.target);
          }
        }),
      { rootMargin: "0px 0px -22% 0px", threshold: 0.2 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="world" aria-labelledby="world-title">
      <h2 id="world-title" className="world-title">
        A ROOM THAT ONLY MAKES SENSE <span>IF YOU WERE THERE.</span>
      </h2>

      <div className="world-field">
        {/* TEA dominates: the one interaction worth reading at full size. */}
        <article data-vignette className="vg vg-tea">
          <div className="vg-copy">
            <h3>SPILL, SAFELY</h3>
            <p>Threads that never leave the room. What gets said in TEA stays with the people in it.</p>
          </div>
          <div className="spill" aria-label="Example TEA thread">
            <p className="spill-msg spill-in">
              <b>meher · 11:47 pm</b>
              <span>wait WHAT happened at the canteen 👀</span>
            </p>
            <p className="spill-msg spill-out">
              <b>you</b>
              <span>not in the group chat. TEA room, now.</span>
            </p>
            <p className="spill-react" aria-label="6 people reacted">
              <span>☕</span> 6 spilled
            </p>
          </div>
        </article>

        {/* CREATE: three frames from one shoot that fan out when they arrive. */}
        <article data-vignette className="vg vg-create" data-hover>
          <div className="fan" aria-hidden="true">
            <Shot id="mirrorTrio" decorative sizes="(max-width: 760px) 34vw, 12vw" className="fan-frame" />
            <Shot id="holi03" decorative sizes="(max-width: 760px) 34vw, 12vw" className="fan-frame" />
            <Shot id="corridorMirror" decorative sizes="(max-width: 760px) 34vw, 12vw" className="fan-frame" />
          </div>
          <div className="vg-copy">
            <h3>MAKE THE<br />DAMN REEL</h3>
            <p>Idea, shot list, who&apos;s filming. The reel you keep not making finally gets made.</p>
          </div>
        </article>

        {/* ONE DAY: a postcard that rises into place. */}
        <article data-vignette className="vg vg-oneday">
          <figure className="card-rise">
            <Shot id="parkSelfie" sizes="(max-width: 760px) 70vw, 22vw" ratio={false} className="card-rise-img" />
            <figcaption>
              <b>GOA · WINTER</b>
              <span>7 in · 2 maybe · 1 &ldquo;budget?&rdquo;</span>
            </figcaption>
          </figure>
          <div className="vg-copy">
            <h3>SOMEDAY,<br />SCHEDULED</h3>
          </div>
        </article>

        {/* ALIGN: crooked labels that snap onto one line. */}
        <article data-vignette className="vg vg-align">
          <div className="vg-copy">
            <h3>FREE<br />SATURDAY?</h3>
          </div>
          <div className="snap" aria-label="Plan: Saturday 7:30, Bandra, 8 of 9 in">
            <span>SAT 7:30</span>
            <span>BANDRA</span>
            <span>8/9 IN</span>
          </div>
        </article>

        {/* VAULT: the real photos, stacked, spreading when they arrive. */}
        <article data-vignette className="vg vg-vault" data-hover>
          <div className="stack" aria-hidden="true">
            <Shot id="iceCreams" decorative sizes="(max-width: 760px) 40vw, 14vw" className="stack-photo" />
            <Shot id="redThreads" decorative sizes="(max-width: 760px) 40vw, 14vw" className="stack-photo" />
            <Shot id="holiLaugh" decorative sizes="(max-width: 760px) 40vw, 14vw" className="stack-photo" />
          </div>
          <div className="vg-copy">
            <h3>THE GOOD<br />ONES</h3>
            <p>Every photo from the day, only for the people who were in it.</p>
          </div>
        </article>
      </div>
    </section>
  );
}
