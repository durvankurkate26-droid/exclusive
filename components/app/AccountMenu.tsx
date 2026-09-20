"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import type { Group, Profile, Role } from "@/lib/supabase/database.types";
import { Avatar } from "./Avatar";

/**
 * Account + group switcher, behind one avatar.
 *
 * A popover rather than a permanent panel: on a screen whose whole job is the five
 * rooms, an always-visible account column steals width from the thing people came
 * for. Dismissal is handled for pointer (outside click), keyboard (Escape) and focus
 * (leaving the popover) — a menu that traps a keyboard user is worse than no menu.
 */
export function AccountMenu({
  profile,
  avatarUrl,
  group,
  role,
  groups,
}: {
  profile: Profile;
  avatarUrl: string | null;
  group: Group;
  role: Role;
  groups: Array<{ group: Group; role: Role }>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const others = groups.filter((entry) => entry.group.id !== group.id);

  return (
    <div className="account" ref={rootRef}>
      <button
        className="account-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${profile.display_name}`}
      >
        <Avatar url={avatarUrl} name={profile.display_name} size={30} />
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <div className="account-identity">
            <Avatar url={avatarUrl} name={profile.display_name} size={38} />
            <div>
              <p className="account-name">{profile.display_name}</p>
              <p className="account-handle">@{profile.username}</p>
            </div>
          </div>

          <div className="account-group">
            <p className="account-section">THIS GROUP</p>
            <p className="account-group-name">{group.name}</p>
            <p className="account-handle">you&apos;re {role === "owner" ? "the owner" : role}</p>
          </div>

          <div className="account-links">
            <Link role="menuitem" href={`/g/${group.slug}/members`} onClick={() => setOpen(false)}>
              Members
            </Link>
            <Link role="menuitem" href={`/g/${group.slug}/settings`} onClick={() => setOpen(false)}>
              Group settings
            </Link>
          </div>

          {others.length > 0 && (
            <div className="account-links">
              <p className="account-section">SWITCH</p>
              {others.map((entry) => (
                <Link
                  key={entry.group.id}
                  role="menuitem"
                  href={`/g/${entry.group.slug}`}
                  onClick={() => setOpen(false)}
                >
                  {entry.group.name}
                </Link>
              ))}
            </div>
          )}

          <div className="account-links">
            <Link role="menuitem" href="/groups" onClick={() => setOpen(false)}>
              New or join a group
            </Link>
            <form action={signOut}>
              <button className="account-signout" type="submit" role="menuitem">
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
