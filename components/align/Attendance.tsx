"use client";

import { useOptimistic, useTransition } from "react";
import { setAttendance } from "@/lib/actions/rooms";
import type { Attendance as AttendanceValue } from "@/lib/supabase/database.types";

const CHOICES: Array<{ value: AttendanceValue; label: string }> = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Can't" },
];

/**
 * In / maybe / out.
 *
 * Three buttons, always all three visible, with the current answer filled in. A
 * dropdown would hide the fact that "maybe" is a legitimate answer, and "maybe" is
 * the honest state most people are in most of the time — a plan that forces a yes/no
 * before anyone knows the date just collects lies.
 */
export function AttendanceControl({
  planId,
  slug,
  current,
}: {
  planId: string;
  slug: string;
  current: AttendanceValue | null;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(
    current,
    (_state, next: AttendanceValue) => next,
  );

  return (
    <div className="rsvp" role="group" aria-label="Are you coming?">
      {CHOICES.map((choice) => (
        <button
          key={choice.value}
          className="rsvp-choice"
          type="button"
          data-value={choice.value}
          data-active={value === choice.value}
          aria-pressed={value === choice.value}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setValue(choice.value);
              await setAttendance(planId, slug, choice.value);
            })
          }
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
