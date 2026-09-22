"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addIdea, type FormState } from "@/lib/actions/rooms";
import { Sheet } from "@/components/app/Sheet";
import { Plus } from "@/components/app/Icons";
import { toast } from "@/components/app/Toast";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-lit" type="submit" disabled={pending}>
      {pending ? "Pinning…" : "Put it on the wall"}
    </button>
  );
}

/**
 * A someday in one line. The picture link is behind a disclosure — most ideas start
 * as a sentence in the group chat, not a moodboard, and an empty image field makes
 * a thought feel like homework.
 */
export function AddIdea({ groupId, slug, defaultOpen }: { groupId: string; slug: string; defaultOpen?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(addIdea, {});
  const [withPicture, setWithPicture] = useState(false);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (state.message) {
      closeRef.current();
      toast("On the wall. Your hand's already up.");
    }
  }, [state]);

  return (
    <Sheet
      title="One day we should…"
      defaultOpen={defaultOpen}
      trigger={(open) => (
        <button className="btn btn-lit" type="button" onClick={open}>
          <Plus width={16} height={16} /> Add a someday
        </button>
      )}
    >
      {(close) => {
        closeRef.current = close;
        return (
          <form action={action} className="field" style={{ gap: "1.25rem" }}>
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="slug" value={slug} />
            <label className="sr-only" htmlFor="idea-title">The idea</label>
            <input id="idea-title" className="input input-title" name="title" placeholder="Drive to Goa without telling anyone" maxLength={120} required autoFocus />
            <div className="field">
              <label className="field-label" htmlFor="idea-desc">Why, where, with whom <span className="field-hint">optional</span></label>
              <textarea id="idea-desc" className="textarea" name="description" maxLength={280} rows={2} placeholder="Leave Friday night. Come back when we come back." />
            </div>
            {withPicture ? (
              <div className="field">
                <label className="field-label" htmlFor="idea-image">Picture link</label>
                <input id="idea-image" className="input" name="image_url" type="url" inputMode="url" placeholder="https://…" />
                <span className="field-hint">A photo of the place, the poster, the vibe.</span>
              </div>
            ) : (
              <button className="go go-quiet" type="button" onClick={() => setWithPicture(true)} style={{ justifySelf: "start" }}>
                + Add a picture link
              </button>
            )}
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
