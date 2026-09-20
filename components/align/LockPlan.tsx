"use client";

import { useState, useTransition } from "react";
import { captureToVault, lockPlan, unlockPlan } from "@/lib/actions/rooms";
import { shortDate } from "@/lib/format";

/**
 * The end of the argument.
 *
 * The button states, in words, exactly what it is about to freeze — the winning date,
 * the winning place, the winning number — before you press it. A "Confirm" that does
 * not show you what it is confirming is how a group ends up locked into a Tuesday
 * nobody voted for.
 *
 * It refuses when a date or a place is missing, and says which. That refusal is the
 * feature: a locked plan reading "date: TBD" is the exact ambiguity this room exists
 * to delete.
 */
export function LockPlan({
  planId,
  slug,
  date,
  location,
  budget,
  missing,
}: {
  planId: string;
  slug: string;
  date: string | null;
  location: string | null;
  budget: string | null;
  missing: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (missing.length > 0) {
    return (
      <div className="lock lock-blocked">
        <p className="lock-line">
          Can&apos;t lock this yet — still no{" "}
          <strong>{missing.join(" and no ")}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="lock">
      <p className="lock-line">
        Locking this fixes it as{" "}
        <strong>{date ? shortDate(date) : "—"}</strong> at{" "}
        <strong>{location}</strong>
        {budget ? (
          <>
            , <strong>{budget}</strong>
          </>
        ) : null}
        .
      </p>
      <button
        className="btn btn-primary"
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await lockPlan(planId, slug, date, location, budget);
            setError(result.error ?? null);
          })
        }
      >
        {pending ? "Locking…" : "Lock it in ↗"}
      </button>
      {error && (
        <p className="inline-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Locked does not mean permanent. Plans move, and a group that cannot reopen one will
 * just abandon it and start a second plan for the same night.
 */
export function UnlockPlan({ planId, slug }: { planId: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn"
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unlockPlan(planId, slug);
        })
      }
    >
      {pending ? "…" : "Reopen it"}
    </button>
  );
}

/**
 * ALIGN -> VAULT. The plan happened; it becomes a memory seeded with everyone who
 * said they were coming, so nobody has to rebuild the guest list from photographs.
 */
export function CaptureToVault({ planId, slug }: { planId: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        className="btn btn-room"
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await captureToVault(planId, slug);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Saving…" : "This happened — put it in the Vault ↗"}
      </button>
      {error && (
        <p className="inline-form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
