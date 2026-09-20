"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCapsule, type FormState } from "@/lib/actions/vault";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Opening…" : "Open the capsule ↗"}
    </button>
  );
}

/**
 * Starting a memory.
 *
 * Deliberately not an upload dialog. You name the night first and put the photographs
 * in afterwards, because a capsule is a thing that happened — "Rohan's terrace, the
 * night it rained" — not a folder you drag files into. The date is optional: half of
 * these get made months later when somebody finds the photos.
 */
export function CreateCapsule({ groupId, slug }: { groupId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(createCapsule, {});

  if (!open) {
    return (
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        New memory ↗
      </button>
    );
  }

  return (
    <form className="inline-form" action={action}>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        name="title"
        placeholder="the night we…"
        maxLength={120}
        required
        autoFocus
        aria-label="What happened"
      />
      <input
        name="memory_date"
        type="date"
        aria-label="When it happened"
        title="When it happened"
      />
      <textarea
        name="description"
        placeholder="set the scene (optional)"
        maxLength={600}
        rows={2}
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
