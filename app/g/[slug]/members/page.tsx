import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup, getGroupMembers, roomContext } from "@/lib/data/session";
import { getMemberStats } from "@/lib/data/people";
import { resolveAvatars } from "@/lib/data/media";
import { Avatar } from "@/components/app/Avatar";
import { Photo } from "@/components/app/Photo";
import { InvitePanel, MemberControls } from "@/components/members/MemberControls";
import { firstName } from "@/components/app/People";
import { tilt } from "@/lib/art";

export const metadata: Metadata = { title: "Members · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const WORDS = ["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/**
 * MEMBERS: the people who make the place matter.
 *
 * Portraits, not rows. Each person is a face, a name in display type, their bio in
 * their own words, one line of real context ("3 teas, in on 7 plans") and the actual
 * memories they're in, as small prints you can open. Admin controls exist but fold
 * away under the person they apply to, and only for admins. The invite lives at the
 * end, the way more people get in.
 *
 * The face slot is a plain avatar today; it is deliberately a self-contained element
 * so a future EXCLUSIVE character can replace it without touching the layout.
 */
export default async function MembersPage({ params }: PageProps<"/g/[slug]/members">) {
  const { slug } = await params;
  const { groupId } = await roomContext(slug);
  const [{ group, profile, role }, members, { stats, memories }] = await Promise.all([
    requireGroup(slug),
    getGroupMembers(groupId),
    getMemberStats(groupId),
  ]);
  const avatars = await resolveAvatars(members.map((m) => m.profile));
  const isAdmin = role === "owner" || role === "admin";

  const line = (id: string) => {
    const s = stats.get(id);
    if (!s) return "Just got here.";
    const parts = [
      s.teas && `${s.teas} ${s.teas === 1 ? "tea" : "teas"} started`,
      s.plans && `in on ${s.plans} ${s.plans === 1 ? "plan" : "plans"}`,
      s.ideas && `${s.ideas} ${s.ideas === 1 ? "someday" : "somedays"}`,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "Quiet one.";
  };

  // The invite carries the group's face: a few of its own photographs.
  const groupPhotos = [
    ...new Map(
      [...memories.values()].flat().filter((m) => m.cover).map((m) => [m.id, m.cover as string]),
    ).values(),
  ].slice(0, 4);

  return (
    <div className="people">
      <header className="room-intro">
        <h1 className="display people-title">
          {members.length === 1 ? "Just you." : `The ${WORDS[members.length] ?? members.length} of you.`}
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
          const theirs = memories.get(person.id) ?? [];
          const prints = theirs.filter((m) => m.cover).slice(0, 3);
          return (
            <li
              key={person.id}
              className="portrait"
              data-me={isMe}
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
                  {memberRole !== "member" && <b>, {memberRole}</b>}
                </span>
                {person.bio && <span className="portrait-bio">{person.bio}</span>}
                <span className="portrait-stats meta">{line(person.id)}</span>
              </span>

              {theirs.length > 0 && (
                <div className="portrait-memories">
                  {prints.length > 0 && (
                    <span className="portrait-prints">
                      {prints.map((m, j) => (
                        <Link
                          key={m.id}
                          href={`/g/${slug}/vault/${m.id}`}
                          className="portrait-print"
                          style={{ ["--r" as string]: `${tilt(m.id + person.id, 6)}deg`, ["--j" as string]: j }}
                          aria-label={`${m.title}, a memory ${firstName(person.display_name)} is in`}
                        >
                          <Photo src={m.cover} sizes="96px" />
                        </Link>
                      ))}
                    </span>
                  )}
                  <Link className="portrait-memories-line" href={`/g/${slug}/vault?who=${person.id}`}>
                    In {theirs.length} {theirs.length === 1 ? "memory" : "memories"}
                  </Link>
                </div>
              )}

              {controllable && (
                <details className="member-manage">
                  <summary>Manage {firstName(person.display_name)}</summary>
                  <MemberControls groupId={group.id} userId={person.id} name={person.display_name} role={memberRole} />
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <InvitePanel
        groupId={group.id}
        groupName={group.name}
        code={group.invite_code}
        memberCount={members.length}
        canRotate={isAdmin}
        photos={groupPhotos}
      />
    </div>
  );
}
