"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/animations/gsap";

export function ScrollProgress() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = progressRef.current;
    if (!element) return;

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => gsap.set(element, { scaleX: self.progress }),
    });

    return () => trigger.kill();
  }, []);

  return <div ref={progressRef} className="scroll-progress" aria-hidden="true" />;
}
