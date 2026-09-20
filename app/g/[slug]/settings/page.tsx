import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { resolveAvatars } from "@/lib/data/media";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import {
  DangerZone,
  GroupForm,
  ProfileForm,
} from "@/components/settings/SettingsForms";

export const metadata: Metadata = { title: "Settings · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.home;

/**
 * SETTINGS — small on purpose.
 *
 * Four things: what the group is called, who you are, how people get in, and how you
 * get out. Everything a settings page usually accumulates — notification preferences,
 * themes, integrations — would be inventing product surface nobody asked for, in a
 * room that exists to be visited twice.
 *
 * The invite code is shown but not managed here; rotating it lives on MEMBERS, next
 * to the people it governs.
 */
export default async function SettingsPage({ params }: PageProps<"/g/[slug]/settings">) {
  const { slug } = await params;
  const { group, profile, role } = await requireGroup(slug);
  const avatars = await resolveAvatars([profile]);

  const isAdmin = role === "owner" || role === "admin";

  return (
    <div className="room room-settings" style={{ ["--room" as string]: room.accent }}>
      <header className="room-head" style={{ ["--room" as string]: room.accent }}>
        <div className="room-head-text">
          <p className="room-kicker">SETTINGS</p>
          <h1 className="room-title">The boring but necessary bit.</h1>
        </div>
      </header>

      <div className="settings">
        <section className="settings-block">
          <h2 className="section-label">THIS GROUP</h2>
          <GroupForm
            groupId={group.id}
            name={group.name}
            description={group.description}
            canEdit={isAdmin}
          />
        </section>

        <section className="settings-block">
          <h2 className="section-label">YOU</h2>
          <ProfileForm
            displayName={profile.display_name}
            username={profile.username}
            bio={profile.bio}
            avatarUrl={avatars.get(profile.id) ?? null}
          />
        </section>

        <section className="settings-block">
          <h2 className="section-label">GETTING IN</h2>
          <p className="settings-code">{group.invite_code}</p>
          <p className="settings-note">
            Share this and anyone can join.{" "}
            <Link href={`/g/${slug}/members`}>Manage it on Members ↗</Link>
          </p>
        </section>

        <section className="settings-block">
          <h2 className="section-label">THE EXIT</h2>
          <DangerZone groupId={group.id} groupName={group.name} role={role} />
        </section>
      </div>
    </div>
  );
}
