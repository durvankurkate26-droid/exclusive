import type { Metadata } from "next";
import { requireGroup, getGroupMembers } from "@/lib/data/session";
import { getMemberStats } from "@/lib/data/people";
import { resolveAvatars } from "@/lib/data/media";
import { Avatar } from "@/components/app/Avatar";
import { InvitePanel, MemberControls } from "@/components/members/MemberControls";
import { tilt } from "@/lib/art";

export const metadata: Metadata = { title: "Members · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * MEMBERS — the people who make the place matter.
 *
 * Portraits, not rows. Each person is a face, a name in display type, their bio in
 * their own words, and one line of real context ("3 teas · 7 plans · 22 memories")
 * that says what they are like *here*. Admin controls exist but sit small beneath the
 * person they apply to, and only for admins. The invite lives at the end — the way
 * more people get in.
 */
export default async function MembersPage({ params }: PageProps<"/g/[slug]/members">) {
  const { slug } = await params;
  const { group, profile, role } = await requireGroup(slug);

  const [members, stats] = await Promise.all([getGroupMembers(group.id), getMemberStats(group.id)]);
  const avatars = await resolveAvatars(members.map((m) => m.profile));
  const isAdmin = role === "owner" || role === "admin";

  const line = (id: string) => {
    const s = stats.get(id);
    if (!s) return "Just got here.";
    const parts = [
      s.teas && `${s.teas} ${s.teas === 1 ? "tea" : "teas"} started`,
      s.plans && `in on ${s.plans} ${s.plans === 1 ? "plan" : "plans"}`,
      s.memories && `${s.memories} ${s.memories === 1 ? "memory" : "memories"}`,
      s.ideas && `${s.ideas} ${s.ideas === 1 ? "someday" : "somedays"}`,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Quiet one.";
  };

  return (
    <div className="people">
      <header className="room-intro">
        <h1 className="display people-title">
          {members.length === 1 ? "Just you." : `The ${["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][members.length] ?? members.length} of you.`}
        </h1>
      </header>

      {members.length === 1 && (
        <div className="empty">
          <p className="empty-line">This room needs people.</p>
          <p className="empty-hint">Share the invite below. It works best when the whole group chat is in here.</p>
        </div>
      )}

      <ul className="portraits">
        {members.map(({ profile: person, role: memberRole }, i) => {
          const isMe = person.id === profile.id;
          const controllable = isAdmin && !isMe && memberRole !== "owner";
          return (
            <li
              key={person.id}
              className="portrait"
              data-me={isMe}
              tabIndex={0}
              style={{ ["--t" as string]: `${tilt(person.id, 2)}deg`, ["--i" as string]: i }}
            >
              <span className="portrait-face">
                <Avatar url={avatars.get(person.id) ?? null} name={person.display_name} size={112} />
              </span>
              <span className="portrait-text">
                <span className="display portrait-name">
                  {person.display_name}
                  {isMe && <span className="portrait-you">you</span>}
                </span>
                <span className="portrait-handle">
                  @{person.username}
                  {memberRole !== "member" && <b> · {memberRole}</b>}
                </span>
                {person.bio && <span className="portrait-bio">{person.bio}</span>}
                <span className="portrait-stats meta">{line(person.id)}</span>
              </span>
              {controllable && (
                <MemberControls groupId={group.id} userId={person.id} name={person.display_name} role={memberRole} />
              )}
            </li>
          );
        })}
      </ul>

      <InvitePanel groupId={group.id} groupName={group.name} code={group.invite_code} memberCount={members.length} canRotate={isAdmin} />
    </div>
  );
}
