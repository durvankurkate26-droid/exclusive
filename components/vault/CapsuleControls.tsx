"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  addMemoryNote,
  deleteCapsule,
  deleteMemoryNote,
  toggleCapsuleParticipant,
  updateCapsule,
  type FormState,
} from "@/lib/actions/vault";
import { Avatar } from "@/components/app/Avatar";
import { Close } from "@/components/app/Icons";
import { Sheet } from "@/components/app/Sheet";
import { toast } from "@/components/app/Toast";
import { firstName, type Person } from "@/components/app/People";

/**
 * Who was there. Tap a face to tag or untag it; the change is optimistic, and its
 * base is the server prop, so someone else's tagging arrives on the next render.
 */
export function ParticipantPicker({
  capsuleId,
  slug,
  members,
  taggedIds,
}: {
  capsuleId: string;
  slug: string;
  members: Person[];
  taggedIds: string[];
}) {
  const [, startTransition] = useTransition();
  const [tagged, setTagged] = useOptimistic(taggedIds, (_current, next: string[]) => next);

  return (
    <ul className="tagger">
      {members.map((member) => {
        const on = tagged.includes(member.id);
        return (
          <li key={member.id}>
            <button
              type="button"
              className="tagger-face"
              data-on={on}
              aria-pressed={on}
              onClick={() =>
                startTransition(async () => {
                  setTagged(on ? tagged.filter((id) => id !== member.id) : [...tagged, member.id]);
                  const result = await toggleCapsuleParticipant(capsuleId, member.id, slug);
                  if (result.error) toast(result.error, "error");
                })
              }
            >
              <Avatar url={member.url} name={member.name} size={48} />
              <span>{firstName(member.name)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NoteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-sm" type="submit" disabled={pending}>
      {pending ? "…" : "Keep it"}
    </button>
  );
}

/** "Something somebody said." One line, kept forever. */
export function NoteComposer({ capsuleId, slug }: { capsuleId: string; slug: string }) {
  const [state, action] = useActionState<FormState, FormData>(addMemoryNote, {});
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !state.error) formRef.current?.reset();
    submitted.current = false;
  }, [state]);

  return (
    <form ref={formRef} className="note-form" action={action} onSubmit={() => (submitted.current = true)}>
      <input type="hidden" name="capsule_id" value={capsuleId} />
      <input type="hidden" name="slug" value={slug} />
      <label className="sr-only" htmlFor="note">A line somebody said</label>
      <input id="note" className="input" name="note" placeholder="Something somebody said…" maxLength={500} required />
      <NoteSubmit />
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </form>
  );
}

export function DeleteNote({ noteId, capsuleId, slug }: { noteId: string; capsuleId: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="note-delete"
      type="button"
      aria-label="Delete this line"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteMemoryNote(noteId, capsuleId, slug);
          if (result.error) toast(result.error, "error");
        })
      }
    >
      <Close width={14} height={14} />
    </button>
  );
}

function EditSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-lit" type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

/** Rename, re-date, re-describe — and, for its keeper or an admin, delete. */
export function CapsuleAdmin({
  capsuleId,
  slug,
  title,
  description,
  memoryDate,
  photoCount,
  canDelete,
}: {
  capsuleId: string;
  slug: string;
  title: string;
  description: string | null;
  memoryDate: string | null;
  photoCount: number;
  canDelete: boolean;
}) {
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState<FormState, FormData>(updateCapsule, {});

  useEffect(() => {
    if (state.message) toast("Saved.");
  }, [state]);

  return (
    <Sheet
      title="Edit this memory"
      trigger={(open) => (
        <button className="btn btn-ghost btn-sm" type="button" onClick={open}>
          Edit
        </button>
      )}
    >
      {(close) => (
        <div className="field" style={{ gap: "1.5rem" }}>
          <form action={action} className="field" style={{ gap: "1rem" }}>
            <input type="hidden" name="capsule_id" value={capsuleId} />
            <input type="hidden" name="slug" value={slug} />
            <label className="sr-only" htmlFor="edit-title">Title</label>
            <input id="edit-title" className="input input-title" name="title" defaultValue={title} maxLength={120} required />
            <div className="field">
              <label className="field-label" htmlFor="edit-date">When</label>
              <input id="edit-date" className="input" name="memory_date" type="date" defaultValue={memoryDate ?? ""} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-desc">The scene</label>
              <textarea id="edit-desc" className="textarea" name="description" defaultValue={description ?? ""} maxLength={600} rows={3} />
            </div>
            {state.error && <p className="form-error" role="alert">{state.error}</p>}
            <div className="sheet-actions">
              <button className="btn btn-ghost" type="button" onClick={close}>Done</button>
              <EditSubmit />
            </div>
          </form>

          {canDelete && (
            <div className="danger">
              <p className="danger-line">
                Deleting removes{" "}
                <strong>
                  {photoCount} {photoCount === 1 ? "photo" : "photos"}
                </strong>{" "}
                from storage for everyone. There is no undo.
              </p>
              <div className="form-row">
                <label className="sr-only" htmlFor="confirm-delete">Type DELETE to confirm</label>
                <input
                  id="confirm-delete"
                  className="input"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Type DELETE"
                  style={{ flex: "1 1 10rem" }}
                />
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={confirm !== "DELETE" || pending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await deleteCapsule(capsuleId, slug);
                      } catch (cause) {
                        if (cause instanceof Error && cause.message.includes("NEXT_REDIRECT")) throw cause;
                        toast("Couldn't delete this memory. Try again.", "error");
                      }
                    })
                  }
                >
                  {pending ? "Deleting…" : "Delete memory"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
