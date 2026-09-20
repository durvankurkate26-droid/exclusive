"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { addIdea, type FormState } from "@/lib/actions/rooms";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Pinning…" : "Put it up ↗"}
    </button>
  );
}

/**
 * Adding a someday.
 *
 * A title and one line, same as TEA. The whole premise of ONE DAY is that saying the
 * thing out loud costs nothing — a date field or a category picker would turn "we
 * should go to Goa" into a commitment, which is exactly what ALIGN is for and exactly
 * what this room is not.
 */
export function AddIdea({ groupId, slug }: { groupId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(addIdea, {});

  // The action stays on the page rather than redirecting, so the form has to close
  // itself once the idea is on the wall.
  useEffect(() => {
    if (state.message) setOpen(false);
  }, [state.message]);

  if (!open) {
    return (
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        Add a someday ↗
      </button>
    );
  }

  return (
    <form className="inline-form" action={action}>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        name="title"
        placeholder="the thing we keep saying"
        maxLength={120}
        required
        autoFocus
        aria-label="The idea"
      />
      <input
        name="description"
        placeholder="why, or where, or with whom (optional)"
        maxLength={280}
        aria-label="Description"
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
