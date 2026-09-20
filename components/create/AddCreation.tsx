"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { addCreation, type FormState } from "@/lib/actions/rooms";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Pinning…" : "Pin it up ↗"}
    </button>
  );
}

/**
 * Putting something on the wall.
 *
 * The reference link is first, because that is how these actually start — somebody
 * sends a reel and says "we should do this". The title comes second and the
 * description is optional, which matches the order the thought arrives in rather than
 * the order a database would like it.
 */
export function AddCreation({ groupId, slug }: { groupId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(addCreation, {});

  useEffect(() => {
    if (state.message) setOpen(false);
  }, [state.message]);

  if (!open) {
    return (
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        Pin an idea ↗
      </button>
    );
  }

  return (
    <form className="inline-form" action={action}>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        name="reference_url"
        type="url"
        placeholder="paste the reel / the reference (optional)"
        aria-label="Reference link"
      />
      <input
        name="title"
        placeholder="what are we making"
        maxLength={120}
        required
        autoFocus
        aria-label="What are we making"
      />
      <textarea
        name="description"
        placeholder="the idea, in a line or two (optional)"
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
