"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  scheduleShoot,
  setCreateRole,
  setCreateStatus,
  toggleCreateJoin,
} from "@/lib/actions/rooms";
import {
  CREATE_PIPELINE,
  CREATE_ROLES,
  CREATE_ROLE_LABEL,
  CREATE_STATUS_LABEL,
} from "@/lib/constants/create";
import type { CreateRole, CreateStatus } from "@/lib/supabase/database.types";

/** "I'm on this." Optimistic for the same reason ONE DAY's hand is. */
export function JoinCreation({
  createId,
  slug,
  joined,
}: {
  createId: string;
  slug: string;
  joined: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [isIn, setIsIn] = useOptimistic(joined, (_state, next: boolean) => next);

  return (
    <button
      className="hands"
      type="button"
      data-mine={isIn}
      aria-pressed={isIn}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setIsIn(!isIn);
          await toggleCreateJoin(createId, slug);
        })
      }
    >
      <span className="hands-mark" aria-hidden="true">
        {isIn ? "✓" : "+"}
      </span>
      <span className="hands-label">{isIn ? "you're on it" : "I'm on it"}</span>
    </button>
  );
}

/**
 * Optional roles.
 *
 * Optional is the whole design. A shoot where four people have to pick a job before
 * anything can start is a shoot that does not happen; a shoot where one person says
 * "I'll film" is one that does. So this is a row of soft toggles that defaults to
 * nothing selected, and clicking your current role clears it.
 */
export function RolePicker({
  createId,
  slug,
  role,
}: {
  createId: string;
  slug: string;
  role: CreateRole | null;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(
    role,
    (_state, next: CreateRole | null) => next,
  );

  return (
    <div className="roles" role="group" aria-label="What are you doing on this?">
      {CREATE_ROLES.map((option) => (
        <button
          key={option}
          className="role-chip"
          type="button"
          data-active={current === option}
          aria-pressed={current === option}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const next = current === option ? null : option;
              setCurrent(next);
              await setCreateRole(createId, slug, next);
            })
          }
        >
          {CREATE_ROLE_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

/**
 * Where it is in the pipeline.
 *
 * A ladder, not a kanban board: the states are a sequence and the thing can only be
 * in one of them, so dragging cards between columns would be ceremony around a single
 * value. Any member can move it — a group of nine does not need an approval step to
 * say "we shot it".
 */
export function StatusLadder({
  createId,
  slug,
  status,
}: {
  createId: string;
  slug: string;
  status: CreateStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(
    status,
    (_state, next: CreateStatus) => next,
  );

  const reached = CREATE_PIPELINE.indexOf(current);

  return (
    <div className="ladder" role="group" aria-label="Where is this up to?">
      {CREATE_PIPELINE.map((step, index) => (
        <button
          key={step}
          className="ladder-step"
          type="button"
          data-state={index < reached ? "past" : index === reached ? "now" : "ahead"}
          aria-pressed={index === reached}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setCurrent(step);
              await setCreateStatus(createId, slug, step);
            })
          }
        >
          <span className="ladder-dot" aria-hidden="true" />
          <span className="ladder-label">{CREATE_STATUS_LABEL[step]}</span>
        </button>
      ))}
    </div>
  );
}

/** CREATE -> ALIGN. Booking the day is a planning problem, so it goes to ALIGN. */
export function ScheduleShoot({
  createId,
  slug,
  crewCount,
}: {
  createId: string;
  slug: string;
  crewCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="make-real">
      <button
        className="btn btn-room"
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await scheduleShoot(createId, slug);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Opening…" : "Schedule the shoot ↗"}
      </button>
      <p className="make-real-line">
        Opens a plan in ALIGN with{" "}
        {crewCount === 1 ? "you" : `all ${crewCount} of you`} already down.
      </p>
      {error && (
        <p className="inline-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
