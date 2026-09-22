"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startTea, type FormState } from "@/lib/actions/tea";
import { Sheet } from "@/components/app/Sheet";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-lit" type="submit" disabled={pending}>
      {pending ? "Pouring…" : "Drop it"}
    </button>
  );
}

/**
 * Two fields and a verb. A title and one optional line of context — no categories,
 * no visibility toggles. Anything more turns a reflex into a form.
 */
export function StartTea({ groupId, slug, defaultOpen }: { groupId: string; slug: string; defaultOpen?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(startTea, {});

  return (
    <Sheet
      title="What happened?"
      intro="Title it like you'd say it out loud. Details go in the conversation."
      defaultOpen={defaultOpen}
      trigger={(open) => (
        <button className="btn btn-lit tea-drop" type="button" onClick={open}>
          Drop the tea
        </button>
      )}
    >
      {(close) => (
        <form action={action} className="field" style={{ gap: "1.25rem" }}>
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="slug" value={slug} />
          <label className="sr-only" htmlFor="tea-title">What happened</label>
          <input id="tea-title" className="input input-title" name="title" placeholder="yk what happened" maxLength={140} required autoFocus />
          <div className="field">
            <label className="field-label" htmlFor="tea-context">One line of context <span className="field-hint">optional</span></label>
            <input id="tea-context" className="input" name="context" placeholder="The wedding one. You know the one." maxLength={280} />
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
