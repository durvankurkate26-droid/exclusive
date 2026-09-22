"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { finishCreation, scheduleShoot, setCreateRole, setCreateStatus, toggleCreateJoin } from "@/lib/actions/rooms";
import { CREATE_ROLES, CREATE_ROLE_LABEL } from "@/lib/constants/create";
import { Avatar } from "@/components/app/Avatar";
import { Check, Plus } from "@/components/app/Icons";
import { Sheet } from "@/components/app/Sheet";
import { flash, toast } from "@/components/app/Toast";
import type { Person } from "@/components/app/People";
import type { CreateRole, CreateStatus } from "@/lib/supabase/database.types";

/**
 * "I'm in" for a make, with the crew right beside it. Optimistic: your face joins
 * the crew the moment you press, and the line under it updates — "5 PEOPLE ARE DOWN."
 */
export function JoinCrew({
  createId,
  slug,
  me,
  crew,
}: {
  createId: string;
  slug: string;
  me: Person;
  crew: Person[];
}) {
  const [, startTransition] = useTransition();
  const [view, setView] = useOptimistic(crew, (current, add: boolean) =>
    add ? [...current.filter((p) => p.id !== me.id), me] : current.filter((p) => p.id !== me.id),
  );
  const mine = view.some((p) => p.id === me.id);

  return (
    <div className="crew-join">
      <p className="display crew-count">
        {view.length === 0 ? "Nobody's down yet." : `${view.length} ${view.length === 1 ? "person is" : "people are"} down.`}
      </p>
      <div className="hand-row">
        <button
          className="hand"
          type="button"
          aria-pressed={mine}
          onClick={() =>
            startTransition(async () => {
              setView(!mine);
              const result = await toggleCreateJoin(createId, slug);
              if (result.error) toast(result.error, "error");
            })
          }
        >
          <span className="hand-mark" aria-hidden="true">{mine ? <Check /> : <Plus />}</span>
          {mine ? "You're in" : "I'm in"}
        </button>
        <span className="hand-faces" aria-hidden="true">
          {view.slice(-8).map((p) => (
            <span key={p.id} className="hand-face" data-joining={p.id === me.id && mine} title={p.name}>
              <Avatar url={p.url} name={p.name} size={32} />
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/** Light roles. Tap to take one, tap again to drop it. Not an assignment system. */
export function RolePicker({ createId, slug, role }: { createId: string; slug: string; role: CreateRole | null }) {
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(role, (_state, next: CreateRole | null) => next);

  return (
    <div className="roles" role="group" aria-label="Your role">
      {CREATE_ROLES.map((option) => (
        <button
          key={option}
          className="role-chip"
          type="button"
          aria-pressed={current === option}
          onClick={() =>
            startTransition(async () => {
              const next = current === option ? null : option;
              setCurrent(next);
              const result = await setCreateRole(createId, slug, next);
              if (result.error) toast(result.error, "error");
            })
          }
        >
          {CREATE_ROLE_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

const STEPS: Array<{ key: CreateStatus; label: string }> = [
  { key: "idea", label: "Idea" },
  { key: "people_joining", label: "Crew" },
  { key: "scheduled", label: "Shoot" },
  { key: "shot", label: "Shot" },
  { key: "editing", label: "Edit" },
  { key: "posted", label: "Out" },
];

/**
 * The lifecycle as a strip of film frames, and — under it — only the *next* sensible
 * move as a real button. Idea → schedule the shoot (hands off to ALIGN) → we shot it
 * → editing → posted with a link, or done without one.
 */
export function Lifecycle({
  createId,
  slug,
  status,
  planId,
  crewCount,
}: {
  createId: string;
  slug: string;
  status: CreateStatus;
  planId: string | null;
  crewCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(status, (_s, next: CreateStatus) => next);
  const [link, setLink] = useState("");
  const reached = current === "completed" ? STEPS.length : STEPS.findIndex((s) => s.key === current);

  const move = (next: CreateStatus, message: string) =>
    startTransition(async () => {
      setCurrent(next);
      const result = await setCreateStatus(createId, slug, next);
      if (result.error) toast(result.error, "error");
      else toast(message);
    });

  const schedule = () =>
    startTransition(async () => {
      flash("Shoot's in ALIGN. Now pick a day.");
      const result = await scheduleShoot(createId, slug);
      if (result?.error) {
        try { sessionStorage.removeItem("exclusive:flash"); } catch {}
        toast(result.error, "error");
      }
    });

  return (
    <div className="lifecycle">
      <ol className="filmstrip" aria-label="Where this is up to">
        {STEPS.map((step, i) => (
          <li key={step.key} data-state={i < reached ? "past" : i === reached ? "now" : "ahead"} aria-current={i === reached ? "step" : undefined}>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="lifecycle-next">
        {(current === "idea" || current === "people_joining") &&
          (planId ? (
            <Link className="btn btn-lit" href={`/g/${slug}/align/${planId}`}>Open the shoot plan</Link>
          ) : (
            <button className="btn btn-lit" type="button" disabled={pending || crewCount === 0} onClick={schedule}>
              Schedule the shoot
            </button>
          ))}
        {current === "scheduled" && (
          <>
            <button className="btn btn-lit" type="button" disabled={pending} onClick={() => move("shot", "It's in the can.")}>We shot it</button>
            {planId && <Link className="go go-quiet" href={`/g/${slug}/align/${planId}`}>The shoot plan</Link>}
          </>
        )}
        {current === "shot" && (
          <button className="btn btn-lit" type="button" disabled={pending} onClick={() => move("editing", "Someone's editing. Probably at 3am.")}>Someone&apos;s editing</button>
        )}
        {(current === "shot" || current === "editing") && (
          <Sheet
            title="It's out?"
            intro="Paste where it lives and it goes up next to the reference that started it."
            trigger={(open) => (
              <button className="btn" type="button" onClick={open}>It&apos;s out</button>
            )}
          >
            {(close) => (
              <form
                className="field"
                style={{ gap: "1.25rem" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  startTransition(async () => {
                    const result = await finishCreation(createId, slug, "posted", link);
                    if (result.error) toast(result.error, "error");
                    else {
                      toast(result.message ?? "We somehow made it.");
                      close();
                    }
                  });
                }}
              >
                <div className="field">
                  <label className="field-label" htmlFor="result-url">Link to the finished thing <span className="field-hint">optional</span></label>
                  <input id="result-url" className="input" type="url" inputMode="url" placeholder="https://instagram.com/reel/…" value={link} onChange={(e) => setLink(e.target.value)} />
                </div>
                <div className="sheet-actions">
                  <button className="btn btn-ghost" type="button" onClick={() => startTransition(async () => {
                    const result = await finishCreation(createId, slug, "completed", "");
                    if (result.error) toast(result.error, "error");
                    else { toast("Done. Not everything needs posting."); close(); }
                  })}>
                    Done, not posting it
                  </button>
                  <button className="btn btn-lit" type="submit" disabled={pending}>It&apos;s posted</button>
                </div>
              </form>
            )}
          </Sheet>
        )}
        {(current === "posted" || current === "completed") && (
          <>
            <p className="lifecycle-done display">We somehow made it.</p>
            <button className="go go-quiet" type="button" disabled={pending} onClick={() => move("editing", "Back in the edit.")}>Not finished after all</button>
          </>
        )}
      </div>
      {crewCount === 0 && (current === "idea" || current === "people_joining") && !planId && (
        <p className="field-hint">Get at least one person in before booking a shoot.</p>
      )}
    </div>
  );
}

