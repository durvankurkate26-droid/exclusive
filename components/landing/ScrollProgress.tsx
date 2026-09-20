"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/animations/gsap";

export function ScrollProgress() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = progressRef.current;
    if (!element) return;

    // This trigger already measures page progress for the bar, so the shared atmosphere
    // rides on it rather than paying for a second page-wide ScrollTrigger. One variable
    // write per update; the drift itself is pure CSS transform on three fixed layers.
    const world = document.querySelector<HTMLElement>(".world-atmos");

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        gsap.set(element, { scaleX: self.progress });
        world?.style.setProperty("--world-y", self.progress.toFixed(4));
      },
    });

    return () => trigger.kill();
  }, []);

  return <div ref={progressRef} className="scroll-progress" aria-hidden="true" />;
}
