import Link from "next/link";
import type { ReactNode } from "react";
import type { Group, Profile, Role } from "@/lib/supabase/database.types";
import { getMyGroups } from "@/lib/data/session";
import { resolveAvatars } from "@/lib/data/media";
import { AccountMenu } from "./AccountMenu";
import { MobileDock, RoomNav } from "./RoomNav";
import { RoomAtmosphere } from "./RoomAtmosphere";

/**
 * One shell for the whole authenticated product.
 *
 * Every room renders inside this, VAULT included — the brief's hard requirement, and
 * the reason the five rooms feel like one place instead of five apps. Nothing below
 * this component is allowed to replace the navigation; a room that wants more screen
 * uses the space inside `.app-main`.
 *
 * Server component: it resolves the group list and the avatar once per navigation and
 * hands plain data to the two small client islands (the nav indicator and the account
 * popover) that actually need interactivity.
 */
export async function AppShell({
  profile,
  group,
  role,
  children,
}: {
  profile: Profile;
  group: Group;
  role: Role;
  children: ReactNode;
}) {
  const groups = await getMyGroups();
  const avatars = await resolveAvatars([profile]);

  return (
    <div className="app-shell">
      <RoomAtmosphere slug={group.slug} />

      <header className="app-bar">
        <div className="app-bar-left">
          <Link className="app-brand" href={`/g/${group.slug}`}>
            EXCLUSIVE
          </Link>
          <span className="app-bar-divider" aria-hidden="true" />
          <Link className="app-group" href={`/g/${group.slug}`}>
            {group.name}
          </Link>
        </div>

        <RoomNav slug={group.slug} />

        <div className="app-bar-right">
          <AccountMenu
            profile={profile}
            avatarUrl={avatars.get(profile.id) ?? null}
            group={group}
            role={role}
            groups={groups}
          />
        </div>
      </header>

      <main className="app-main">{children}</main>

      <MobileDock slug={group.slug} />
    </div>
  );
}
