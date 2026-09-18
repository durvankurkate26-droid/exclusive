"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "@/lib/animations/gsap";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = gsap.fromTo(element, { autoAlpha: 0, y: 28 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      delay,
      ease: "power2.out",
      scrollTrigger: { trigger: element, start: "top 84%", once: true },
    });
    return () => {
      animation.kill();
    };
  }, [delay]);
  return <div ref={ref} className={className}>{children}</div>;
}
