"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteGroup,
  leaveGroup,
  updateGroup,
  type FormState,
} from "@/lib/actions/groups";
import { updateProfile, uploadAvatar } from "@/lib/actions/profile";
import { Avatar } from "@/components/app/Avatar";
import type { Role } from "@/lib/supabase/database.types";

function Save({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-lit" type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className="form-error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.message) return <p className="form-ok" role="status">{state.message}</p>;
  return null;
}

/** Name and description. Admins only — RLS refuses everyone else anyway. */
export function GroupForm({
  groupId,
  name,
  description,
  canEdit,
}: {
  groupId: string;
  name: string;
  description: string | null;
  canEdit: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateGroup, {});

  return (
    <form className="settings-form" action={action}>
      <input type="hidden" name="group_id" value={groupId} />

      <label className="field">
        <span>Group name</span>
        <input
          name="name"
          defaultValue={name}
          maxLength={60}
          required
          disabled={!canEdit}
        />
      </label>

      <label className="field">
        <span>What this group is</span>
        <textarea
          name="description"
          defaultValue={description ?? ""}
          maxLength={400}
          rows={3}
          placeholder="optional"
          disabled={!canEdit}
        />
      </label>

      {canEdit ? (
        <>
          <Save />
          <Feedback state={state} />
        </>
      ) : (
        <p className="settings-note">Only admins can change this.</p>
      )}
    </form>
  );
}

/** Your own name, bio and face. Everyone can edit their own. */
export function ProfileForm({
  displayName,
  username,
  bio,
  avatarUrl,
}: {
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const [pending, startTransition] = useTransition();
  const [avatarState, setAvatarState] = useState<FormState>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // `uploadAvatar` takes only FormData, so it cannot drive useActionState. Submitting
  // it by hand from the file picker also means the upload starts the moment an image
  // is chosen, with no second "upload" button to forget to press.
  const onPickAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.set("avatar", file);
    startTransition(async () => {
      setAvatarState(await uploadAvatar(body));
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <div className="settings-form">
      <div className="settings-avatar">
        <Avatar url={avatarUrl} name={displayName} size={64} />
        <div>
          <label className="btn settings-avatar-pick">
            {pending ? "Uploading…" : "Change photo"}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onPickAvatar}
              disabled={pending}
              aria-label="Upload a profile photo"
            />
          </label>
          <p className="settings-note">Under 5MB.</p>
          <Feedback state={avatarState} />
        </div>
      </div>

      <form action={action}>
        <label className="field">
          <span>Your name</span>
          <input name="display_name" defaultValue={displayName} maxLength={40} required />
        </label>

        <label className="field">
          <span>Username</span>
          <input value={`@${username}`} readOnly disabled />
        </label>

        <label className="field">
          <span>Bio</span>
          <textarea
            name="bio"
            defaultValue={bio ?? ""}
            maxLength={280}
            rows={2}
            placeholder="optional"
          />
        </label>

        <Save />
        <Feedback state={state} />
      </form>
    </div>
  );
}

/**
 * Leaving and deleting.
 *
 * Both confirm, and delete needs the group's name typed out — it destroys every
 * conversation, plan and photograph the group has, and the difference between that
 * and leaving is not something a shared "are you sure" should blur.
 */
export function DangerZone({
  groupId,
  groupName,
  role,
}: {
  groupId: string;
  groupName: string;
  role: Role;
}) {
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isOwner = role === "owner";

  const run = (fn: () => Promise<FormState>) =>
    startTransition(async () => {
      try {
        const result = await fn();
        setError(result?.error ?? null);
      } catch (cause) {
        // A successful action redirects, and redirect() signals that by throwing.
        if (cause instanceof Error && cause.message.includes("NEXT_REDIRECT")) throw cause;
        setError("That didn't work.");
      }
    });

  return (
    <div className="danger">
      {isOwner ? (
        <>
          <p className="danger-line">
            You own {groupName}. Owners can&apos;t leave. Deleting is the only exit, and
            it takes every message, plan and photograph with it.
          </p>
          <div className="form-row">
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={`type ${groupName}`}
              aria-label={`Type ${groupName} to confirm deletion`}
            />
            <button
              className="btn btn-danger"
              type="button"
              disabled={confirm !== groupName || pending}
              onClick={() => run(() => deleteGroup(groupId))}
            >
              {pending ? "Deleting…" : "Delete this group"}
            </button>
          </div>
        </>
      ) : leaving ? (
        <>
          <p className="danger-line">
            Leave {groupName}? You&apos;ll need the invite code to get back in.
          </p>
          <div className="form-row">
            <button
              className="btn btn-danger"
              type="button"
              disabled={pending}
              onClick={() => run(() => leaveGroup(groupId))}
            >
              {pending ? "Leaving…" : "Yes, leave"}
            </button>
            <button className="btn" type="button" onClick={() => setLeaving(false)}>
              Stay
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="danger-line">Done with this group?</p>
          <button className="btn" type="button" onClick={() => setLeaving(true)}>
            Leave {groupName}
          </button>
        </>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
