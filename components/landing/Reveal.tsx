"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "@/lib/animations/gsap";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Shifts this block's band later so siblings resolve in sequence, not in lockstep. */
  delay?: number;
};

/**
 * Scroll-linked reveal for the lower page.
 *
 * This used to be `once: true`: the block crossed 84% of the viewport and then played a
 * 0.9s fade-up on its own clock, ignoring the scrollbar entirely and never reversing.
 * Ten of those drive the whole bottom third, which is why that stretch read as a series
 * of things popping rather than as continuous motion.
 *
 * Now the band is scrubbed, so stopping mid-scroll leaves a valid intermediate state and
 * scrolling back up runs it backwards. The travel is deliberately small and the ease is
 * `none`: with scroll driving progress, a strong curve just reads as the block lurching.
 */
export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const offset = Math.round(delay * 100);
      const animation = gsap.fromTo(
        element,
        { autoAlpha: 0, y: 34 },
        {
          autoAlpha: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: () => `top ${92 - offset * 0.12}%`,
            end: () => `top ${58 - offset * 0.12}%`,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        },
      );
      return () => {
        animation.scrollTrigger?.kill();
        animation.kill();
      };
    });

    return () => media.revert();
  }, [delay]);

  return <div ref={ref} className={className}>{children}</div>;
}
