import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { listIdeas } from "@/lib/data/one-day";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { RoomHeader, EmptyState } from "@/components/app/RoomHeader";
import { AvatarStack } from "@/components/app/Avatar";
import { AddIdea } from "@/components/oneday/AddIdea";
import { InterestButton, MakeThisReal } from "@/components/oneday/IdeaActions";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "One Day · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY["one-day"];

/**
 * ONE DAY — the wall of futures.
 *
 * Posters, not task cards. Every decision here is aimed at that: the type is huge and
 * the metadata is small, the cards are different sizes, and the wall is a masonry
 * column flow rather than a grid of equal tiles. A someday that eight people want
 * should physically dominate one that somebody typed this morning, which is why the
 * leading idea gets pulled out as a headline rather than being first in a list.
 *
 * The only number on a poster is how many hands are up, because that is the only
 * number that decides whether it ever leaves this room.
 */
export default async function OneDayPage({ params }: PageProps<"/g/[slug]/one-day">) {
  const { slug } = await params;
  const { group, profile } = await requireGroup(slug);
  const { ideas, promoted, memberCount, avatars } = await listIdeas(group.id, profile.id);

  const [headline, ...wall] = ideas;
  const faces = (people: { id: string; display_name: string }[]) =>
    people.map((person) => ({
      id: person.id,
      name: person.display_name,
      url: avatars.get(person.id) ?? null,
    }));

  return (
    <div className="room room-oneday" style={{ ["--room" as string]: room.accent }}>
      <RoomHeader
        room={room}
        count={ideas.length ? `${ideas.length} ON THE WALL` : undefined}
      >
        <AddIdea groupId={group.id} slug={slug} />
      </RoomHeader>

      {ideas.length === 0 && promoted.length === 0 ? (
        <EmptyState line={room.empty.line} hint={room.empty.hint}>
          <AddIdea groupId={group.id} slug={slug} />
        </EmptyState>
      ) : (
        <>
          {/* -------------------------------------------------- the loud one */}
          {headline && (
            <article className="poster poster-headline">
              <div className="poster-body">
                <p className="poster-index">
                  MOST WANTED
                  <span>
                    {headline.people.length}/{memberCount}
                  </span>
                </p>
                <Link href={`/g/${slug}/one-day/${headline.id}`} className="poster-link">
                  <h2 className="poster-title">{headline.title}</h2>
                </Link>
                {headline.description && (
                  <p className="poster-line">{headline.description}</p>
                )}
                <div className="poster-foot">
                  <InterestButton
                    ideaId={headline.id}
                    slug={slug}
                    mine={headline.mine}
                    count={headline.people.length}
                    total={memberCount}
                  />
                  {headline.people.length > 0 && (
                    <AvatarStack people={faces(headline.people)} max={7} size={30} />
                  )}
                </div>
              </div>

              <aside className="poster-side">
                <p className="poster-meta">
                  put up by {headline.author?.display_name ?? "someone"}
                  <br />
                  {timeAgo(headline.created_at)}
                </p>
                {headline.people.length >= 2 ? (
                  <MakeThisReal
                    ideaId={headline.id}
                    slug={slug}
                    count={headline.people.length}
                  />
                ) : (
                  <p className="poster-gate">
                    One more hand and this can become a real plan.
                  </p>
                )}
              </aside>
            </article>
          )}

          {/* -------------------------------------------------- the rest of the wall */}
          {wall.length > 0 && (
            <section className="wall-section">
              <h2 className="section-label">ALSO SOMEDAY</h2>
              <div className="wall">
                {wall.map((idea, index) => (
                  <article
                    key={idea.id}
                    className="poster"
                    /* Cards alternate weight so the wall reads as pinned paper rather
                       than a grid. It is index-based, not random, so it is stable
                       across renders. */
                    data-weight={index % 3}
                  >
                    <p className="poster-index">
                      {String(index + 2).padStart(2, "0")}
                      <span>
                        {idea.people.length}/{memberCount}
                      </span>
                    </p>
                    <Link href={`/g/${slug}/one-day/${idea.id}`} className="poster-link">
                      <h3 className="poster-title">{idea.title}</h3>
                    </Link>
                    {idea.description && <p className="poster-line">{idea.description}</p>}
                    <div className="poster-foot">
                      <InterestButton
                        ideaId={idea.id}
                        slug={slug}
                        mine={idea.mine}
                        count={idea.people.length}
                        total={memberCount}
                      />
                      {idea.people.length > 0 && (
                        <AvatarStack people={faces(idea.people)} max={5} size={24} />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* -------------------------------------------------- already left the wall */}
          {promoted.length > 0 && (
            <section className="wall-section">
              <h2 className="section-label">THIS ACTUALLY HAPPENED</h2>
              <ul className="promoted-list">
                {promoted.map((idea) => (
                  <li key={idea.id}>
                    <Link href={`/g/${slug}/one-day/${idea.id}`}>
                      <span className="promoted-title">{idea.title}</span>
                      <span className="promoted-state">
                        {idea.status === "completed" ? "done" : "moved to align"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
