"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPlan, type FormState } from "@/lib/actions/rooms";
import { Sheet } from "@/components/app/Sheet";
import { Plus } from "@/components/app/Icons";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-lit" type="submit" disabled={pending}>
      {pending ? "Opening…" : "Start figuring it out"}
    </button>
  );
}

/**
 * Starting a plan from nothing: only a name. Date, place and budget are exactly the
 * things the group has not agreed on yet — asking the opener to fill them in makes
 * them the decision-maker, which is the job ALIGN exists so nobody has to do.
 */
export function CreatePlan({
  groupId,
  slug,
  defaultOpen,
  label = "Start a plan",
}: {
  groupId: string;
  slug: string;
  defaultOpen?: boolean;
  label?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(createPlan, {});

  return (
    <Sheet
      title="What are we trying to make happen?"
      intro="Just name it. Dates, places and who's coming get sorted inside."
      defaultOpen={defaultOpen}
      trigger={(open) => (
        <button className="btn btn-lit" type="button" onClick={open}>
          <Plus width={16} height={16} /> {label}
        </button>
      )}
    >
      {(close) => (
        <form action={action} className="field" style={{ gap: "1.25rem" }}>
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="slug" value={slug} />
          <label className="sr-only" htmlFor="plan-title">Plan name</label>
          <input
            id="plan-title"
            className="input input-title"
            name="title"
            placeholder="Sunday lunch, the long one"
            maxLength={120}
            required
            autoFocus
          />
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
