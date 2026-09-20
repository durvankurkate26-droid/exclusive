"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPlan, type FormState } from "@/lib/actions/rooms";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Opening…" : "Start figuring it out ↗"}
    </button>
  );
}

/**
 * Starting a plan from nothing.
 *
 * Only a title. Every other field a planning tool would ask for here — date, place,
 * budget — is deliberately absent, because those are the things the group has not
 * agreed on yet. Asking the person who opens the plan to fill them in makes them the
 * decision-maker, and ALIGN exists precisely because nobody wants to be that person.
 */
export function CreatePlan({ groupId, slug }: { groupId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(createPlan, {});

  if (!open) {
    return (
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        New plan ↗
      </button>
    );
  }

  return (
    <form className="inline-form" action={action}>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        name="title"
        placeholder="what are we trying to make happen"
        maxLength={120}
        required
        autoFocus
        aria-label="What are we planning"
      />
      <div className="inline-form-actions">
        <Submit />
        <button className="btn" type="button" onClick={() => setOpen(false)}>
          Never mind
        </button>
      </div>
      {state.error && (
        <p className="inline-form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
