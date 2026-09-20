import type { Metadata } from "next";
import { requireGroup, getGroupMembers } from "@/lib/data/session";
import { resolveAvatars } from "@/lib/data/media";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { Avatar } from "@/components/app/Avatar";
import { InvitePanel, MemberControls } from "@/components/members/MemberControls";

export const metadata: Metadata = { title: "Members · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.home;

/**
 * MEMBERS — the wall of faces.
 *
 * Explicitly not an admin table. A table's job is to compare rows on shared
 * attributes; this page's job is to show you nine specific people, so the face is the
 * largest element, the name is set in display type, and the role is a small mark in
 * the corner rather than a column.
 *
 * Admin controls are present but subordinate — they appear under the person they
 * apply to, and only for admins. Nobody opens this page to administrate; they open it
 * to see who is in here and to get the invite code out.
 */
export default async function MembersPage({ params }: PageProps<"/g/[slug]/members">) {
  const { slug } = await params;
  const { group, profile, role } = await requireGroup(slug);

  const members = await getGroupMembers(group.id);
  const avatars = await resolveAvatars(members.map((m) => m.profile));

  const isAdmin = role === "owner" || role === "admin";

  return (
    <div className="room room-members" style={{ ["--room" as string]: room.accent }}>
      <header className="room-head" style={{ ["--room" as string]: room.accent }}>
        <div className="room-head-text">
          <p className="room-kicker">
            {group.name.toUpperCase()} · {members.length}{" "}
            {members.length === 1 ? "PERSON" : "PEOPLE"}
          </p>
          <h1 className="room-title">Everyone who&apos;s in here.</h1>
        </div>
      </header>

      <InvitePanel groupId={group.id} code={group.invite_code} canRotate={isAdmin} />

      <ul className="member-wall">
        {members.map(({ profile: person, role: memberRole }) => {
          const isMe = person.id === profile.id;
          const controllable = isAdmin && !isMe && memberRole !== "owner";

          return (
            <li key={person.id} className="member-card" data-me={isMe}>
              <div className="member-face">
                <Avatar
                  url={avatars.get(person.id) ?? null}
                  name={person.display_name}
                  size={92}
                />
              </div>

              <div className="member-identity">
                <h2 className="member-name">
                  {person.display_name}
                  {isMe && <span className="member-you">you</span>}
                </h2>
                <p className="member-handle">@{person.username}</p>
                {person.bio && <p className="member-bio">{person.bio}</p>}
              </div>

              <span className="member-role" data-role={memberRole}>
                {memberRole}
              </span>

              {controllable && (
                <MemberControls
                  groupId={group.id}
                  userId={person.id}
                  name={person.display_name}
                  role={memberRole}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
