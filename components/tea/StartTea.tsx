"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { startTea, type FormState } from "@/lib/actions/tea";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Pouring…" : "Drop the tea ↗"}
    </button>
  );
}

/**
 * Two fields and a verb.
 *
 * The brief for this is "it should feel like *drop the tea*", so it is a title, an
 * optional line of context, and nothing else — no category picker, no visibility
 * toggle. Anything more turns a reflex into a form.
 */
export function StartTea({ groupId, slug }: { groupId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(startTea, {});

  if (!open) {
    return (
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        Start tea ↗
      </button>
    );
  }

  return (
    <form className="inline-form" action={action}>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        name="title"
        placeholder="what happened"
        maxLength={140}
        required
        autoFocus
        aria-label="What happened"
      />
      <input
        name="context"
        placeholder="one line of context (optional)"
        maxLength={280}
        aria-label="Context"
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
