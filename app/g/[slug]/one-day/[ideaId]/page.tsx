import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup, getGroupMembers } from "@/lib/data/session";
import { getIdea } from "@/lib/data/one-day";
import { resolveAvatars } from "@/lib/data/media";
import { Avatar } from "@/components/app/Avatar";
import { ArrowLeft } from "@/components/app/Icons";
import { firstName, toPeople } from "@/components/app/People";
import { IdeaHand, MakeThisReal } from "@/components/oneday/IdeaActions";
import { Poster } from "@/components/oneday/Poster";
import { LiveRefresh } from "@/lib/realtime";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "One Day · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * One idea, up close: the poster on the left, the people on the right — who is in,
 * who has not said anything yet (by name, because that is how groups actually nudge
 * each other), and the button that makes it real once there are enough hands.
 */
export default async function IdeaDetail({ params }: PageProps<"/g/[slug]/one-day/[ideaId]">) {
  const { slug, ideaId } = await params;
  const { group, profile } = await requireGroup(slug);
  const [{ idea, memberCount, planId, avatars }, members] = await Promise.all([
    getIdea(ideaId, profile.id),
    getGroupMembers(group.id),
  ]);

  if (!idea || idea.group_id !== group.id) notFound();

  const memberAvatars = await resolveAvatars(members.map((m) => m.profile));
  const av = new Map([...memberAvatars, ...avatars]);
  const me = { id: profile.id, name: profile.display_name, url: av.get(profile.id) ?? null };
  const people = toPeople(idea.people, av);
  const inIds = new Set(idea.people.map((p) => p.id));
  const quiet = members.filter((m) => !inIds.has(m.profile.id)).map((m) => m.profile);
  const majority = Math.max(2, Math.ceil(memberCount / 2));
  const promoted = idea.status === "moved_to_align" || idea.status === "completed";
  const ready = idea.people.length >= majority;

  return (
    <div className="idea-detail">
      <LiveRefresh id={`idea-${idea.id}`} tables={[{ table: "one_day_interest", filter: `idea_id=eq.${idea.id}` }]} />

      <Link className="back" href={`/g/${slug}/one-day`}>
        <ArrowLeft /> The wall
      </Link>

      <div className="idea-detail-grid">
        <Poster
          id={idea.id}
          href={`/g/${slug}/one-day/${idea.id}`}
          format="poster"
          title={idea.title}
          description={idea.description}
          image={idea.image_url}
          count={idea.people.length}
          total={memberCount}
          author={firstName(idea.author?.display_name)}
          ready={ready && !promoted}
        />

        <div className="idea-detail-side">
          <p className="meta">Put up by {idea.author?.display_name ?? "someone"} · {timeAgo(idea.created_at)}</p>

          {promoted ? (
            <div className="idea-left">
              <p className="display idea-left-line">This one left the wall.</p>
              <p className="lede">It&apos;s a real plan now — dates, places, the headcount.</p>
              {planId && (
                <Link className="btn btn-lit" href={`/g/${slug}/align/${planId}`}>
                  Open it in ALIGN
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="display idea-detail-line">
                {ready
                  ? "Okay… this might actually happen."
                  : idea.people.length === 0
                    ? "Nobody's in. Yet."
                    : `${majority - idea.people.length} more and it's real.`}
              </p>
              <IdeaHand ideaId={idea.id} slug={slug} me={me} people={people} total={memberCount} />
              {idea.people.length >= 2 && (
                <MakeThisReal ideaId={idea.id} slug={slug} title={idea.title} people={people} />
              )}
            </>
          )}

          {quiet.length > 0 && !promoted && (
            <div className="idea-quiet">
              <p className="meta">HAVEN&apos;T SAID ANYTHING</p>
              <ul>
                {quiet.map((p) => (
                  <li key={p.id} title={p.display_name}>
                    <Avatar url={av.get(p.id) ?? null} name={p.display_name} size={30} />
                    <span>{firstName(p.display_name)}</span>
                  </li>
                ))}
              </ul>
              {quiet.length <= 3 && (
                <p className="lede">Someone convince {quiet.map((p) => firstName(p.display_name)).join(" and ")}.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
