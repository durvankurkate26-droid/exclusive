"use client";

import { useOptimistic, useState, useTransition } from "react";
import { makeThisReal, toggleInterest } from "@/lib/actions/rooms";

/**
 * "I'm in."
 *
 * Optimistic, because raising your hand should feel like raising your hand. The
 * server is authoritative on the next render; if it disagrees the count simply
 * corrects itself, which is a better failure than a button that sits there thinking
 * while you wonder whether it registered.
 */
export function InterestButton({
  ideaId,
  slug,
  mine,
  count,
  total,
}: {
  ideaId: string;
  slug: string;
  mine: boolean;
  count: number;
  total: number;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useOptimistic(
    { mine, count },
    (_current, next: { mine: boolean; count: number }) => next,
  );

  const toggle = () =>
    startTransition(async () => {
      setState({ mine: !state.mine, count: state.count + (state.mine ? -1 : 1) });
      await toggleInterest(ideaId, slug);
    });

  return (
    <button
      className="hands"
      type="button"
      onClick={toggle}
      disabled={pending}
      data-mine={state.mine}
      aria-pressed={state.mine}
    >
      <span className="hands-mark" aria-hidden="true">
        {state.mine ? "✓" : "+"}
      </span>
      <span className="hands-label">
        {state.mine ? "you're in" : "I'm in"}
        <span className="hands-count">
          {state.count}/{total}
        </span>
      </span>
    </button>
  );
}

/**
 * ONE DAY -> ALIGN.
 *
 * Confirms first. This is the one button in the room that changes what the idea *is*
 * — it leaves the wall and becomes a plan with a date attached — and the RPC carries
 * everyone's raised hand across with it, so it is not an action to fire by accident.
 */
export function MakeThisReal({
  ideaId,
  slug,
  count,
}: {
  ideaId: string;
  slug: string;
  count: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = () =>
    startTransition(async () => {
      const result = await makeThisReal(ideaId, slug);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
    });

  if (!confirming) {
    return (
      <div className="make-real">
        <button className="btn btn-room" type="button" onClick={() => setConfirming(true)}>
          Make this real ↗
        </button>
        {error && (
          <p className="inline-form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="make-real is-confirming">
      <p className="make-real-line">
        This moves it into ALIGN and brings{" "}
        {count === 1 ? "the one person" : `all ${count} people`} who said they&apos;re in.
      </p>
      <div className="inline-form-actions">
        <button className="btn btn-primary" type="button" onClick={go} disabled={pending}>
          {pending ? "Moving…" : "Do it"}
        </button>
        <button className="btn" type="button" onClick={() => setConfirming(false)}>
          Not yet
        </button>
      </div>
    </div>
  );
}
