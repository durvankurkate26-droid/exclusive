import Link from "next/link";
import type { ReactNode } from "react";
import type { Group, Profile, Role } from "@/lib/supabase/database.types";
import { getGroupMembers, getMyGroups } from "@/lib/data/session";
import { resolveAvatars } from "@/lib/data/media";
import { AccountMenu } from "./AccountMenu";
import { AvatarStack } from "./Avatar";
import { MobileDock, RoomNav } from "./RoomNav";
import { RoomStage, ShellRoot } from "./RoomAtmosphere";
import { PulseDrawer } from "./PulseDrawer";
import { Toaster } from "./Toast";

/**
 * One shell for the whole authenticated product.
 *
 * Every room renders inside this, VAULT included, so the rooms read as one place.
 * The bar is deliberately thin: the wordmark and the group on the left, the rooms in
 * the middle, and on the right the three things that are about *people* — who is in
 * here, what they have been doing, and you.
 *
 * Server component. The layout persists across navigations, so this renders once per
 * visit and hands plain data to the small client islands that need interactivity.
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
  const [groups, members] = await Promise.all([getMyGroups(), getGroupMembers(group.id)]);
  const avatars = await resolveAvatars([profile, ...members.map((m) => m.profile)]);

  const people = members.map(({ profile: p }) => ({
    id: p.id,
    name: p.display_name,
    url: avatars.get(p.id) ?? null,
  }));

  return (
    <ShellRoot slug={group.slug}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="app-bar">
        <div className="app-bar-left">
          <Link className="app-brand" href={`/g/${group.slug}`} aria-label={`EXCLUSIVE — ${group.name} home`}>
            EXCLUSIVE
          </Link>
          <Link className="app-group" href={`/g/${group.slug}/members`}>
            <span>{group.name}</span>
          </Link>
        </div>

        <RoomNav slug={group.slug} />

        <div className="app-bar-right">
          <Link className="bar-faces" href={`/g/${group.slug}/members`} aria-label={`${members.length} people in ${group.name}`}>
            <AvatarStack people={people} max={4} size={24} />
            <span aria-hidden="true">{members.length}</span>
          </Link>
          <PulseDrawer slug={group.slug} />
          <AccountMenu
            profile={profile}
            avatarUrl={avatars.get(profile.id) ?? null}
            group={group}
            role={role}
            groups={groups}
          />
        </div>
      </header>

      <main className="app-main" id="main">
        <RoomStage slug={group.slug}>{children}</RoomStage>
      </main>

      <MobileDock slug={group.slug} />
      <Toaster />
    </ShellRoot>
  );
}
