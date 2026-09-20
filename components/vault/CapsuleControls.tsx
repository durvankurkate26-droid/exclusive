"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
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

/**
 * Who was there.
 *
 * Every member of the group is shown, tagged or not, and tapping a face toggles it.
 * This is not an invite list — everyone can already see the capsule — it is the
 * record of who was in the room that night, which is the thing people actually argue
 * about years later.
 */
export function ParticipantPicker({
  capsuleId,
  slug,
  members,
  taggedIds,
}: {
  capsuleId: string;
  slug: string;
  members: Array<{ id: string; name: string; url: string | null }>;
  taggedIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  // useOptimistic rather than useState: its base is the prop, so when somebody else
  // tags a face and the page revalidates, this picker picks the change up. A
  // useState initialised from props would keep showing the list as it was when the
  // component mounted.
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
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setTagged(
                    on
                      ? tagged.filter((id) => id !== member.id)
                      : [...tagged, member.id],
                  );
                  await toggleCapsuleParticipant(capsuleId, member.id, slug);
                })
              }
            >
              <Avatar url={member.url} name={member.name} size={44} />
              <span>{member.name.split(" ")[0]}</span>
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
    <button className="btn btn-room" type="submit" disabled={pending}>
      {pending ? "…" : "Add it"}
    </button>
  );
}

/**
 * Notes and quotes.
 *
 * Short, 500 characters, and rendered as pull-quotes rather than comments. What gets
 * written here is "you said you'd never do that again" — a fragment, not a thread —
 * and treating it typographically as a quote is what keeps VAULT from becoming a
 * comment section under a photo album.
 */
export function NoteComposer({
  capsuleId,
  slug,
}: {
  capsuleId: string;
  slug: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(addMemoryNote, {});

  return (
    <form className="note-form" action={action}>
      <input type="hidden" name="capsule_id" value={capsuleId} />
      <input type="hidden" name="slug" value={slug} />
      <textarea
        name="note"
        placeholder="something somebody said…"
        maxLength={500}
        rows={2}
        required
        aria-label="A note or a quote"
      />
      <NoteSubmit />
      {state.error && (
        <p className="inline-form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function DeleteNote({
  noteId,
  capsuleId,
  slug,
}: {
  noteId: string;
  capsuleId: string;
  slug: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="note-delete"
      type="button"
      aria-label="Delete this note"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteMemoryNote(noteId, capsuleId, slug);
        })
      }
    >
      ×
    </button>
  );
}

function EditSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

/**
 * Editing the capsule, and deleting it.
 *
 * Delete is typed-confirmation rather than a second "are you sure": this removes
 * every photograph in the memory from storage permanently, and a group's photographs
 * are the one thing in this product that cannot be recreated by typing it again.
 */
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
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, action] = useActionState<FormState, FormData>(updateCapsule, {});

  if (!open) {
    return (
      <button className="capsule-edit" type="button" onClick={() => setOpen(true)}>
        Edit this memory
      </button>
    );
  }

  return (
    <div className="capsule-admin">
      <form className="inline-form" action={action}>
        <input type="hidden" name="capsule_id" value={capsuleId} />
        <input type="hidden" name="slug" value={slug} />
        <input
          name="title"
          defaultValue={title}
          maxLength={120}
          required
          aria-label="Title"
        />
        <input
          name="memory_date"
          type="date"
          defaultValue={memoryDate ?? ""}
          aria-label="When it happened"
        />
        <textarea
          name="description"
          defaultValue={description ?? ""}
          maxLength={600}
          rows={2}
          placeholder="set the scene"
          aria-label="Description"
        />
        <div className="inline-form-actions">
          <EditSubmit />
          <button className="btn" type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
        {state.error && (
          <p className="inline-form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.message && <p className="uploader-done">{state.message}</p>}
      </form>

      {canDelete && (
        <div className="danger">
          <p className="danger-line">
            Deleting this removes{" "}
            <strong>
              {photoCount} {photoCount === 1 ? "photograph" : "photographs"}
            </strong>{" "}
            from storage. There is no undo.
          </p>
          <div className="danger-row">
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="type DELETE"
              aria-label="Type DELETE to confirm"
            />
            <button
              className="btn danger-btn"
              type="button"
              disabled={confirm !== "DELETE" || pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await deleteCapsule(capsuleId, slug);
                  } catch (cause) {
                    // A redirect throws by design; anything else is a real failure.
                    if (cause instanceof Error && cause.message.includes("NEXT_REDIRECT")) {
                      throw cause;
                    }
                    setError("Could not delete this memory.");
                  }
                })
              }
            >
              {pending ? "Deleting…" : "Delete this memory"}
            </button>
          </div>
          {error && (
            <p className="inline-form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
