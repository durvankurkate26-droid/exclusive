"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addCreation, type FormState } from "@/lib/actions/rooms";
import { Sheet } from "@/components/app/Sheet";
import { Plus } from "@/components/app/Icons";
import { toast } from "@/components/app/Toast";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-lit" type="submit" disabled={pending}>
      {pending ? "Pinning…" : "Pin it to the wall"}
    </button>
  );
}

/**
 * The reference comes first, because that is how these start: somebody sends a reel
 * and says "we should do this". Then a name for it. The description is optional.
 */
export function AddCreation({ groupId, slug, defaultOpen }: { groupId: string; slug: string; defaultOpen?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(addCreation, {});
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (state.message) {
      closeRef.current();
      toast("On the wall. You're already on the crew.");
    }
  }, [state]);

  return (
    <Sheet
      title="What are we making?"
      defaultOpen={defaultOpen}
      trigger={(open) => (
        <button className="btn btn-lit" type="button" onClick={open}>
          <Plus width={16} height={16} /> Pin a make
        </button>
      )}
    >
      {(close) => {
        closeRef.current = close;
        return (
          <form action={action} className="field" style={{ gap: "1.25rem" }}>
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="slug" value={slug} />
            <div className="field">
              <label className="field-label" htmlFor="make-ref">The reference <span className="field-hint">the reel, the video, the post</span></label>
              <input id="make-ref" className="input" name="reference_url" type="url" inputMode="url" placeholder="https://youtube.com/shorts/…" autoFocus />
            </div>
            <label className="sr-only" htmlFor="make-title">What we&apos;re making</label>
            <input id="make-title" className="input input-title" name="title" placeholder="Recreate this reel" maxLength={120} required />
            <div className="field">
              <label className="field-label" htmlFor="make-desc">The idea <span className="field-hint">optional</span></label>
              <textarea id="make-desc" className="textarea" name="description" maxLength={600} rows={2} placeholder="One shot, no cuts, everyone in it." />
            </div>
            {state.error && <p className="form-error" role="alert">{state.error}</p>}
            <div className="sheet-actions">
              <button className="btn btn-ghost" type="button" onClick={close}>Never mind</button>
              <Submit />
            </div>
          </form>
        );
      }}
    </Sheet>
  );
}
