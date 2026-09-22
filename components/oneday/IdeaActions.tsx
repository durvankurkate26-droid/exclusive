"use client";

import { useOptimistic, useState, useTransition } from "react";
import { makeThisReal, toggleInterest } from "@/lib/actions/rooms";
import { Avatar } from "@/components/app/Avatar";
import { Check, Plus } from "@/components/app/Icons";
import { Sheet } from "@/components/app/Sheet";
import { flash, toast } from "@/components/app/Toast";
import { firstName, type Person } from "@/components/app/People";

/**
 * "I'm in" — the hand going up.
 *
 * The button and the faces are one component so the feedback can be physical: press
 * it and *your* face drops into the row of people who are in, before the server has
 * answered. `6 / 9 ARE IN` updates with it. Take it back and your face lifts out.
 */
export function IdeaHand({
  ideaId,
  slug,
  me,
  people,
  total,
  compact = false,
}: {
  ideaId: string;
  slug: string;
  me: Person;
  people: Person[];
  total: number;
  compact?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [joined, setJoined] = useState<string | null>(null);
  const [view, setView] = useOptimistic(people, (current, add: boolean) =>
    add ? [...current.filter((p) => p.id !== me.id), me] : current.filter((p) => p.id !== me.id),
  );
  const mine = view.some((p) => p.id === me.id);

  const toggle = () => {
    // Outside the transition: this flag drives the drop-in animation and must commit
    // with the optimistic face, not after the server answers.
    setJoined(mine ? null : me.id);
    startTransition(async () => {
      setView(!mine);
      const result = await toggleInterest(ideaId, slug);
      if (result.error) toast(result.error, "error");
    });
  };

  const shown = view.slice(-(compact ? 5 : 8));

  return (
    <div className="hand-row" data-compact={compact}>
      <button className="hand" type="button" aria-pressed={mine} onClick={toggle}>
        <span className="hand-mark" aria-hidden="true">
          {mine ? <Check /> : <Plus />}
        </span>
        {mine ? "You're in" : "I'm in"}
      </button>
      <span className="hand-people" aria-live="polite">
        <span className="hand-faces" aria-hidden="true">
          {shown.map((p) => (
            <span key={p.id} className="hand-face" data-joining={p.id === joined} title={p.name}>
              <Avatar url={p.url} name={p.name} size={compact ? 26 : 32} />
            </span>
          ))}
        </span>
        <span className="hand-count display">
          <b>{view.length}</b>/{total} {compact ? "" : "are in"}
        </span>
        <span className="sr-only">{view.map((p) => firstName(p.name)).join(", ")}</span>
      </span>
    </div>
  );
}

/**
 * ONE DAY → ALIGN, and the one moment in this room allowed to feel like an event.
 * The confirm sheet says exactly what will happen — who comes along — and the toast
 * on the other side is the room admitting defeat: "Fine. We're actually doing this."
 */
export function MakeThisReal({
  ideaId,
  slug,
  title,
  people,
}: {
  ideaId: string;
  slug: string;
  title: string;
  people: Person[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = () =>
    startTransition(async () => {
      flash("Fine. We're actually doing this.");
      const result = await makeThisReal(ideaId, slug);
      if (result?.error) {
        try {
          sessionStorage.removeItem("exclusive:flash");
        } catch {}
        setError(result.error);
      }
    });

  return (
    <Sheet
      title="Okay… this might actually happen."
      intro={
        <>
          <strong>{title}</strong> moves to ALIGN, where it gets a date, a place and a headcount.{" "}
          {people.length === 1 ? "The one person" : `All ${people.length} people`} who said they&apos;re in come with it.
        </>
      }
      trigger={(open) => (
        <button className="btn btn-lit make-real" type="button" onClick={open}>
          Make this real
        </button>
      )}
    >
      {(close) => (
        <div className="field" style={{ gap: "1.25rem" }}>
          <ul className="make-real-faces">
            {people.map((p) => (
              <li key={p.id}>
                <Avatar url={p.url} name={p.name} size={40} />
                <span>{firstName(p.name)}</span>
              </li>
            ))}
          </ul>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="sheet-actions">
            <button className="btn btn-ghost" type="button" onClick={close}>Not yet</button>
            <button className="btn btn-lit" type="button" onClick={go} disabled={pending}>
              {pending ? "Moving it…" : "Do it"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
