"use client";

import { useOptimistic, useTransition } from "react";
import { setAttendance } from "@/lib/actions/rooms";
import { Avatar } from "@/components/app/Avatar";
import { toast } from "@/components/app/Toast";
import { firstName, type Person } from "@/components/app/People";
import type { Attendance as Status } from "@/lib/supabase/database.types";

const CHOICES: Array<{ value: Status; label: string }> = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Can't" },
];

/**
 * Who's actually coming — IN / MAYBE / OUT, as three piles of faces.
 *
 * Pressing a choice moves *your* face between piles immediately (optimistic), which
 * is the feedback that matters: you can see yourself land. Everyone who has not
 * answered is named in one line, because "7/9 are in" is a number and "Meera is still
 * deciding" is a nudge.
 */
export function Attendance({
  planId,
  slug,
  me,
  roster,
  everyone,
  locked,
}: {
  planId: string;
  slug: string;
  me: Person;
  roster: Array<{ person: Person; status: Status }>;
  everyone: Person[];
  locked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [view, move] = useOptimistic(roster, (current, status: Status) => [
    ...current.filter((entry) => entry.person.id !== me.id),
    { person: me, status },
  ]);

  const mine = view.find((entry) => entry.person.id === me.id)?.status ?? null;
  const pile = (status: Status) => view.filter((entry) => entry.status === status).map((e) => e.person);
  const answered = new Set(view.filter((e) => e.status !== "maybe").map((e) => e.person.id));
  const undecided = everyone.filter((p) => !answered.has(p.id));

  const choose = (status: Status) =>
    startTransition(async () => {
      move(status);
      const result = await setAttendance(planId, slug, status);
      if (result.error) toast(result.error, "error");
    });

  const inCount = pile("in").length;

  return (
    <div className="rsvp">
      <p className="rsvp-headline display">
        <b>{inCount}</b>/{everyone.length} are in
      </p>

      {!locked && (
        <div className="rsvp-choices" role="radiogroup" aria-label="Are you coming?">
          {CHOICES.map((choice) => (
            <button
              key={choice.value}
              className="rsvp-choice"
              type="button"
              role="radio"
              aria-checked={mine === choice.value}
              data-value={choice.value}
              disabled={pending && mine === choice.value}
              onClick={() => choose(choice.value)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}

      <div className="rsvp-piles">
        {(["in", "maybe", "out"] as const).map((status) => {
          const people = pile(status);
          return (
            <div key={status} className="rsvp-pile" data-status={status}>
              <p className="meta">
                {status.toUpperCase()} · {people.length}
              </p>
              <ul>
                {people.map((person) => (
                  <li key={person.id} data-me={person.id === me.id} title={person.name}>
                    <Avatar url={person.url} name={person.name} size={34} />
                    <span>{firstName(person.name)}</span>
                  </li>
                ))}
                {people.length === 0 && <li className="rsvp-none">nobody</li>}
              </ul>
            </div>
          );
        })}
      </div>

      {undecided.length > 0 && (
        <p className="rsvp-nudge">
          {undecided.length === 1
            ? `${firstName(undecided[0].name)} is still deciding.`
            : undecided.length === 2
              ? `${firstName(undecided[0].name)} and ${firstName(undecided[1].name)} are still deciding.`
              : `${firstName(undecided[0].name)}, ${firstName(undecided[1].name)} and ${undecided.length - 2} others are still deciding.`}
        </p>
      )}
    </div>
  );
}
