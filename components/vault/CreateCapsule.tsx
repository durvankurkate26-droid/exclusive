"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCapsule, type FormState } from "@/lib/actions/vault";
import { Sheet } from "@/components/app/Sheet";
import { Plus } from "@/components/app/Icons";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-lit" type="submit" disabled={pending}>
      {pending ? "Opening…" : "Open the capsule"}
    </button>
  );
}

/**
 * A memory starts as a name and a day. Photos, faces and quotes are added inside the
 * capsule, where you can see them land — asking for them up front turns keeping a
 * memory into filling in a form.
 */
export function CreateCapsule({
  groupId,
  slug,
  defaultOpen,
  variant = "lit",
}: {
  groupId: string;
  slug: string;
  defaultOpen?: boolean;
  variant?: "lit" | "quiet";
}) {
  const [state, action] = useActionState<FormState, FormData>(createCapsule, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Sheet
      title="Name the night."
      intro="Photos, faces and the things people said go in once it exists."
      defaultOpen={defaultOpen}
      trigger={(open) => (
        <button className={variant === "lit" ? "btn btn-lit" : "btn"} type="button" onClick={open}>
          <Plus width={16} height={16} /> New memory
        </button>
      )}
    >
      {(close) => (
        <form action={action} className="field" style={{ gap: "1.25rem" }}>
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="slug" value={slug} />
          <label className="sr-only" htmlFor="capsule-title">What happened</label>
          <input
            id="capsule-title"
            className="input input-title"
            name="title"
            placeholder="The night the car broke down"
            maxLength={120}
            required
            autoFocus
          />
          <div className="field">
            <label className="field-label" htmlFor="capsule-date">When</label>
            <input id="capsule-date" className="input" name="memory_date" type="date" defaultValue={today} max={today} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="capsule-desc">Set the scene <span className="field-hint">optional</span></label>
            <textarea id="capsule-desc" className="textarea" name="description" maxLength={600} rows={2} placeholder="Who, where, why it mattered" />
          </div>
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          <div className="sheet-actions">
            <button className="btn btn-ghost" type="button" onClick={close}>Never mind</button>
            <Submit />
          </div>
        </form>
      )}
    </Sheet>
  );
}
