"use client";

import { useState, useTransition } from "react";
import { gsap } from "gsap";
import { captureToVault, lockPlan, unlockPlan } from "@/lib/actions/rooms";
import { Lock } from "@/components/app/Icons";
import { toast } from "@/components/app/Toast";

/**
 * The end of the argument — ALIGN's signature moment.
 *
 * A bar that states, in words, exactly what it is about to freeze. Pressing it runs
 * one short GSAP timeline over every element on the page still marked as unresolved
 * (`[data-offset]`): they rotate and slide from their slightly-crooked positions to
 * exactly straight, the whole composition settles, and only then does the verdict
 * land. Misaligned → precise, in about 700ms. The server write runs in parallel, so
 * the animation never makes anybody wait; if the write fails, the page snaps back.
 */
export function LockBar({
  planId,
  slug,
  date,
  place,
  budget,
  going,
  missing,
}: {
  planId: string;
  slug: string;
  date: { iso: string; label: string } | null;
  place: string | null;
  budget: string | null;
  going: number;
  missing: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const lock = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const crooked = document.querySelectorAll<HTMLElement>("[data-offset]");
    const tl = gsap.timeline();

    if (!reduce && crooked.length) {
      tl.to(crooked, {
        rotation: 0,
        x: 0,
        y: 0,
        duration: 0.55,
        ease: "expo.inOut",
        stagger: 0.05,
      }).to(
        ".lockbar",
        { scale: 1.02, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1 },
        "-=0.2",
      );
    }

    startTransition(async () => {
      // Let the page finish straightening before the write lands and swaps in the
      // locked view — the settle *is* the confirmation. Capped at 800ms so a paused
      // ticker (background tab) can never hold the write hostage.
      if (!reduce && crooked.length) {
        await Promise.race([tl.then(() => undefined), new Promise((resolve) => setTimeout(resolve, 800))]);
      }
      const result = await lockPlan(planId, slug, date?.iso ?? null, place, budget);
      if (result.error) {
        tl.reverse();
        setError(result.error);
        toast(result.error, "error");
        return;
      }
      toast(<strong>IT&apos;S HAPPENING.</strong>);
    });
  };

  if (missing.length > 0) {
    return (
      <div className="lockbar" data-ready="false">
        <p className="lockbar-line">
          Can&apos;t lock it yet — nobody has suggested {missing.length === 2 ? "a date or a place" : missing[0] === "date" ? "a date" : "a place"}.
        </p>
      </div>
    );
  }

  return (
    <div className="lockbar" data-ready="true">
      <p className="lockbar-summary">
        <span className="display">{date?.label}</span>
        <span className="display">{place}</span>
        {budget && <span className="display">{budget}</span>}
        <span className="meta">{going} in</span>
      </p>
      <button className="btn btn-lit lockbar-btn" type="button" onClick={lock} disabled={pending}>
        <Lock width={16} height={16} />
        {pending ? "Locking…" : "Lock it"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Locked is not permanent. Plans move; a group that cannot reopen one just abandons it. */
export function UnlockPlan({ planId, slug }: { planId: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn btn-ghost btn-sm"
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await unlockPlan(planId, slug);
          if (result.error) toast(result.error, "error");
          else toast("Reopened. Back to arguing.");
        })
      }
    >
      {pending ? "…" : "Reopen it"}
    </button>
  );
}

/** ALIGN → VAULT: the plan happened, so it becomes a memory seeded with who went. */
export function CaptureToVault({ planId, slug }: { planId: string; slug: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-lit"
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await captureToVault(planId, slug);
          if (result?.error) toast(result.error, "error");
        })
      }
    >
      {pending ? "Opening the vault…" : "It happened — keep it"}
    </button>
  );
}
