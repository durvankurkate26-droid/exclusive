import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { getIdea } from "@/lib/data/one-day";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { Avatar } from "@/components/app/Avatar";
import { InterestButton, MakeThisReal } from "@/components/oneday/IdeaActions";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "One Day · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY["one-day"];

/**
 * One idea, full bleed.
 *
 * The detail view is the poster at full size: the title is the page, the people who
 * want it are named rather than counted, and the single decision available — make it
 * real — sits at the bottom where you land after reading who is in.
 */
export default async function IdeaDetail({
  params,
}: PageProps<"/g/[slug]/one-day/[ideaId]">) {
  const { slug, ideaId } = await params;
  const { group, profile } = await requireGroup(slug);
  const { idea, memberCount, planId, avatars } = await getIdea(ideaId, profile.id);

  // RLS hides another group's idea entirely, so a wrong id and a wrong group look the
  // same from here — which is the point.
  if (!idea || idea.group_id !== group.id) notFound();

  const promoted = idea.status === "moved_to_align" || idea.status === "completed";

  return (
    <div className="room room-idea" style={{ ["--room" as string]: room.accent }}>
      <Link className="thread-back" href={`/g/${slug}/one-day`}>
        ← the wall
      </Link>

      <article className="idea-sheet">
        <p className="room-kicker">
          ONE DAY · <span>{timeAgo(idea.created_at)}</span>
        </p>
        <h1 className="idea-title">{idea.title}</h1>
        {idea.description && <p className="idea-line">{idea.description}</p>}
        <p className="idea-author">
          put up by {idea.author?.display_name ?? "someone"}
        </p>

        <section className="idea-people">
          <h2 className="section-label">
            {idea.people.length === 0
              ? "NOBODY'S IN YET"
              : `${idea.people.length} OF ${memberCount} WANT THIS`}
          </h2>
          {idea.people.length > 0 && (
            <ul className="face-list">
              {idea.people.map((person) => (
                <li key={person.id}>
                  <Avatar
                    url={avatars.get(person.id) ?? null}
                    name={person.display_name}
                    size={38}
                  />
                  <span>{person.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="idea-actions">
          {promoted ? (
            <div className="idea-promoted">
              <p className="idea-promoted-line">
                This one left the wall. It&apos;s a real plan now.
              </p>
              {planId && (
                <Link className="btn btn-room" href={`/g/${slug}/align/${planId}`}>
                  Open it in ALIGN ↗
                </Link>
              )}
            </div>
          ) : (
            <>
              <InterestButton
                ideaId={idea.id}
                slug={slug}
                mine={idea.mine}
                count={idea.people.length}
                total={memberCount}
              />
              {idea.people.length >= 2 ? (
                <MakeThisReal
                  ideaId={idea.id}
                  slug={slug}
                  count={idea.people.length}
                />
              ) : (
                <p className="poster-gate">
                  Two hands and this can move into ALIGN.
                </p>
              )}
            </>
          )}
        </footer>
      </article>
    </div>
  );
}
