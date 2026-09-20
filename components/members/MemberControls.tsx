"use client";

import { useEffect, useState, useTransition } from "react";
import { removeMember, rotateInviteCode, setMemberRole } from "@/lib/actions/groups";
import type { Role } from "@/lib/supabase/database.types";

/**
 * The invite.
 *
 * The code is the loudest thing on the page because it is the thing people came for —
 * it gets read out loud and typed into a group chat, so it is set in large mono with
 * generous letterspacing. Copy writes both the code and the join link, since half the
 * time it is being pasted somewhere clickable.
 */
export function InvitePanel({
  groupId,
  code,
  canRotate,
}: {
  groupId: string;
  code: string;
  canRotate: boolean;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  // The origin is only knowable in the browser, and building it server-side would bake
  // one deployment's hostname into every other deployment's invite link.
  useEffect(() => {
    setLink(`${window.location.origin}/join/${code}`);
  }, [code]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (value: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
    } catch {
      setError("Couldn't copy — select it and copy by hand.");
    }
  };

  return (
    <div className="invite">
      <p className="invite-label">THE WAY IN</p>
      <p className="invite-code">{code}</p>

      <div className="invite-actions">
        <button className="btn" type="button" onClick={() => copy(code, "code")}>
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
        <button
          className="btn"
          type="button"
          disabled={!link}
          onClick={() => copy(link, "link")}
        >
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
        {canRotate && (
          <button
            className="btn invite-rotate"
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await rotateInviteCode(groupId);
                setError(result.error ?? null);
              })
            }
          >
            {pending ? "…" : "New code"}
          </button>
        )}
      </div>

      <p className="invite-note">
        Anyone with this code can walk in. Change it and the old one stops working.
      </p>
      {error && (
        <p className="inline-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Admin controls on one person.
 *
 * Only rendered for admins, and never on the owner or on yourself. Kept to two
 * verbs — promote/demote and remove — because a friend group of nine does not have a
 * permissions matrix, it has "can this person change the group's name".
 */
export function MemberControls({
  groupId,
  userId,
  name,
  role,
}: {
  groupId: string;
  userId: string;
  name: string;
  role: Role;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <div className="member-controls">
        <p className="member-confirm">Remove {name.split(" ")[0]}?</p>
        <button
          className="member-action is-danger"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await removeMember(groupId, userId);
              setError(result.error ?? null);
              setConfirming(false);
            })
          }
        >
          {pending ? "…" : "Yes, remove"}
        </button>
        <button
          className="member-action"
          type="button"
          onClick={() => setConfirming(false)}
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="member-controls">
      <button
        className="member-action"
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setMemberRole(
              groupId,
              userId,
              role === "admin" ? "member" : "admin",
            );
            setError(result.error ?? null);
          })
        }
      >
        {pending ? "…" : role === "admin" ? "Make member" : "Make admin"}
      </button>
      <button
        className="member-action is-danger"
        type="button"
        onClick={() => setConfirming(true)}
      >
        Remove
      </button>
      {error && (
        <p className="inline-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
