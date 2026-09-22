"use client";

import { useEffect, useState, useTransition } from "react";
import { removeMember, rotateInviteCode, setMemberRole } from "@/lib/actions/groups";
import type { Role } from "@/lib/supabase/database.types";
import { Copy, Share } from "@/components/app/Icons";
import { toast } from "@/components/app/Toast";

/**
 * Bring your people in.
 *
 * The code is big because it gets read out loud; the link is one tap to copy; and on
 * phones the native share sheet sends it straight into the group chat it came from.
 * Admins can rotate the code, which kills the old one.
 */
export function InvitePanel({
  groupId,
  groupName,
  code,
  memberCount,
  canRotate,
}: {
  groupId: string;
  groupName: string;
  code: string;
  memberCount: number;
  canRotate: boolean;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState("");
  const [canShare, setCanShare] = useState(false);

  // The origin is only knowable in the browser; baking one deployment's host into the
  // link server-side would break every other deployment's invites.
  useEffect(() => {
    setLink(`${window.location.origin}/join/${code}`);
    setCanShare(typeof navigator.share === "function");
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
      toast("Couldn't copy — select it and copy by hand.", "error");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: `Join ${groupName} on EXCLUSIVE`, text: `You're invited. Code: ${code}`, url: link });
    } catch {
      // Dismissing the share sheet is not an error worth reporting.
    }
  };

  return (
    <section className="invite" aria-labelledby="invite-h">
      <h2 className="display invite-title" id="invite-h">Bring your people in.</h2>
      <p className="lede">
        {memberCount} {memberCount === 1 ? "person is" : "people are"} in {groupName}. Anyone with this code can walk in.
      </p>
      <button className="invite-code" type="button" onClick={() => copy(code, "code")} aria-label={`Invite code ${code}. Copy`}>
        {code.split("").map((char, i) => (
          <span key={i}>{char}</span>
        ))}
        <em>{copied === "code" ? "copied" : "tap to copy"}</em>
      </button>
      <div className="form-row">
        {canShare && (
          <button className="btn btn-lit" type="button" disabled={!link} onClick={share}>
            <Share width={16} height={16} /> Share invite
          </button>
        )}
        <button className={canShare ? "btn" : "btn btn-lit"} type="button" disabled={!link} onClick={() => copy(link, "link")}>
          <Copy width={16} height={16} /> {copied === "link" ? "Link copied" : "Copy link"}
        </button>
        {canRotate && (
          <button
            className="btn btn-ghost"
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await rotateInviteCode(groupId);
                if (result.error) toast(result.error, "error");
                else toast("New code. The old one stopped working.");
              })
            }
          >
            {pending ? "…" : "New code"}
          </button>
        )}
      </div>
    </section>
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
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
