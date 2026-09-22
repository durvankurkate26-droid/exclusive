import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup, roomContext } from "@/lib/data/session";
import { listIdeas } from "@/lib/data/one-day";
import { firstName, toPeople } from "@/components/app/People";
import { AddIdea } from "@/components/oneday/AddIdea";
import { IdeaHand, MakeThisReal } from "@/components/oneday/IdeaActions";
import { Poster, type PosterFormat } from "@/components/oneday/Poster";
import { LiveRefresh } from "@/lib/realtime";
import { format } from "@/lib/art";

export const metadata: Metadata = { title: "One Day · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const SMALL_FORMATS = ["ticket", "postcard", "polaroid"] as const satisfies readonly PosterFormat[];

/**
 * ONE DAY — future memories that haven't happened yet.
 *
 * A pinboard, not a backlog. The idea with the most hands becomes the big poster;
 * everything else is printed on whatever it would be in real life — tickets,
 * postcards, polaroids — each a little crooked, each in its own colours. When an
 * idea gets a majority it changes state visibly ("this might actually happen") and
 * earns the one button that moves it into ALIGN.
 */
export default async function OneDayPage({ params, searchParams }: PageProps<"/g/[slug]/one-day">) {
  const { slug } = await params;
  const { new: wantsNew } = await searchParams;
  const { groupId, viewerId } = await roomContext(slug);
  const [{ group, profile }, { ideas, promoted, memberCount, avatars }] = await Promise.all([
    requireGroup(slug),
    listIdeas(groupId, viewerId),
  ]);

  const me = { id: profile.id, name: profile.display_name, url: avatars.get(profile.id) ?? null };
  const majority = Math.max(2, Math.ceil(memberCount / 2));
  const [lead, ...rest] = ideas;
  const base = `/g/${slug}/one-day`;

  return (
    <div className="oneday">
      <LiveRefresh id={`oneday-${group.id}`} tables={[{ table: "one_day_interest" }]} />

      <header className="room-intro">
        <h1 className="display oneday-title">
          One day<span>, we should…</span>
        </h1>
        <AddIdea groupId={group.id} slug={slug} defaultOpen={wantsNew === "1"} />
      </header>

      {ideas.length === 0 && (
        <div className="empty">
          <p className="empty-line">
            No future bad decisions yet.
          </p>
          <p className="empty-hint">The trip, the drive, the thing you keep saying you should do. Put it up and see who raises a hand.</p>
        </div>
      )}

      {lead && (
        <section className="wall-lead" aria-label="Most wanted">
          <Poster
            id={lead.id}
            href={`${base}/${lead.id}`}
            format="poster"
            title={lead.title}
            description={lead.description}
            image={lead.image_url}
            count={lead.people.length}
            total={memberCount}
            author={firstName(lead.author?.display_name)}
            ready={lead.people.length >= majority}
          />
          <div className="wall-lead-side">
            <p className="wall-lead-line display">
              {lead.people.length >= majority
                ? "Okay… this might actually happen."
                : lead.people.length === 0
                  ? "Nobody's in yet."
                  : `${lead.people.length} ${lead.people.length === 1 ? "person is" : "people are"} in. ${majority - lead.people.length} more and it's real.`}
            </p>
            <IdeaHand ideaId={lead.id} slug={slug} me={me} people={toPeople(lead.people, avatars)} total={memberCount} />
            {(() => {
              const holdouts = memberCount - lead.people.length;
              if (holdouts <= 0 || lead.people.length === 0) return null;
              return <p className="lede">{holdouts === 1 ? "One person is holding out." : `${holdouts} people haven't said anything. Someone convince them.`}</p>;
            })()}
            {lead.people.length >= majority && (
              <MakeThisReal ideaId={lead.id} slug={slug} title={lead.title} people={toPeople(lead.people, avatars)} />
            )}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="wall" aria-label="Every other someday">
          {rest.map((idea) => {
            const ready = idea.people.length >= majority;
            const fmt = idea.image_url ? "polaroid" : format(idea.id, SMALL_FORMATS);
            return (
              <Poster
                key={idea.id}
                id={idea.id}
                href={`${base}/${idea.id}`}
                format={fmt}
                title={idea.title}
                description={idea.description}
                image={idea.image_url}
                count={idea.people.length}
                total={memberCount}
                author={firstName(idea.author?.display_name)}
                ready={ready}
              >
                <IdeaHand ideaId={idea.id} slug={slug} me={me} people={toPeople(idea.people, avatars)} total={memberCount} compact />
              </Poster>
            );
          })}
        </section>
      )}

      {promoted.length > 0 && (
        <section className="oneday-done" aria-labelledby="promoted-h">
          <h2 className="section-title" id="promoted-h">Already happening</h2>
          <ul>
            {promoted.map((idea) => (
              <li key={idea.id}>
                <Link href={`${base}/${idea.id}`}>
                  <span className="display">{idea.title}</span>
                  <span className="oneday-done-stamp">{idea.status === "completed" ? "DONE" : "MOVED TO ALIGN"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
