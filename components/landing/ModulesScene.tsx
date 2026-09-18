"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "@/lib/animations/gsap";
import { rooms } from "@/lib/constants/landing";

function RoomGlyph({ room }: { room: string }) {
  if (room === "TEA") return <div className="room-glyph glyph-tea"><i /><i /><i /></div>;
  if (room === "CREATE") return <div className="room-glyph glyph-create"><i /></div>;
  if (room === "ONE DAY") return <div className="room-glyph glyph-one-day"><b>📍 GOA</b><i /><i /></div>;
  if (room === "ALIGN") return <div className="room-glyph glyph-align">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>;
  return <div className="room-glyph glyph-vault">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>;
}

export function ModulesScene() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const rows = gsap.utils.toArray<HTMLElement>("[data-module-row]");
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: window.matchMedia("(max-width: 640px)").matches ? "+=150%" : "+=190%",
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
          },
        });

        rows.forEach((row, index) => {
          timeline.to(row, { "--on": 1, duration: 0.16, ease: "power2.out" }, index * 0.16);
          if (index < rows.length - 1) {
            timeline.to(row, { "--on": 0, duration: 0.12 }, index * 0.16 + 0.12);
          }
        });
      }, section);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  return (
    <section ref={sectionRef} id="modules-anchor" className="modules-scene scene-screen" aria-labelledby="modules-title">
      <div className="modules-stage">
        <p className="modules-kicker">INSIDE EXCLUSIVE · 05 ROOMS</p>
        <h2 id="modules-title" className="sr-only">The five rooms inside EXCLUSIVE</h2>
        <div className="module-list">
          {rooms.map((room) => (
            <article key={room.name} data-module-row data-accent={room.accent} className="module-row">
              <span className="module-number">{room.number}</span>
              <div className="module-copy">
                <h3>{room.name}</h3>
                <p>{room.description}</p>
              </div>
              <RoomGlyph room={room.name} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
