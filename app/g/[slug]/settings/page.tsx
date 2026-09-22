import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { resolveAvatars } from "@/lib/data/media";
import { DangerZone, GroupForm, ProfileForm } from "@/components/settings/SettingsForms";

export const metadata: Metadata = { title: "Settings · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * SETTINGS — calm, small, done in a minute. Who you are, what the group is called,
 * how people get in (it lives on Members, next to the people it governs), and the
 * way out. Each section is a quiet two-column row: what it is on the left, the
 * controls on the right.
 */
export default async function SettingsPage({ params }: PageProps<"/g/[slug]/settings">) {
  const { slug } = await params;
  const { group, profile, role } = await requireGroup(slug);
  const avatars = await resolveAvatars([profile]);
  const isAdmin = role === "owner" || role === "admin";

  return (
    <div className="settings">
      <header className="room-intro">
        <h1 className="display settings-title">Settings</h1>
      </header>

      <section className="settings-row" aria-labelledby="you-h">
        <div>
          <h2 className="settings-h" id="you-h">You</h2>
          <p className="settings-note">How you show up in every room.</p>
        </div>
        <ProfileForm displayName={profile.display_name} username={profile.username} bio={profile.bio} avatarUrl={avatars.get(profile.id) ?? null} />
      </section>

      <section className="settings-row" aria-labelledby="group-h">
        <div>
          <h2 className="settings-h" id="group-h">{group.name}</h2>
          <p className="settings-note">{isAdmin ? "You can change this because you're an admin." : "Only admins can change this."}</p>
        </div>
        <GroupForm groupId={group.id} name={group.name} description={group.description} canEdit={isAdmin} />
      </section>

      <section className="settings-row" aria-labelledby="in-h">
        <div>
          <h2 className="settings-h" id="in-h">Getting in</h2>
          <p className="settings-note">Invite code, links and sharing live with the people.</p>
        </div>
        <div className="settings-invite">
          <p className="display settings-code">{group.invite_code}</p>
          <Link className="go" href={`/g/${slug}/members`}>Invite people &amp; manage roles</Link>
        </div>
      </section>

      <section className="settings-row settings-danger" aria-labelledby="exit-h">
        <div>
          <h2 className="settings-h" id="exit-h">The exit</h2>
          <p className="settings-note">Leaving is reversible with the code. Deleting is not.</p>
        </div>
        <DangerZone groupId={group.id} groupName={group.name} role={role} />
      </section>
    </div>
  );
}
