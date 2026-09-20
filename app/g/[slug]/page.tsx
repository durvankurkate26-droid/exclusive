import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup, getGroupMembers } from "@/lib/data/session";
import { getHomeSnapshot } from "@/lib/data/home";
import { resolveAvatars } from "@/lib/data/media";
import { AvatarStack } from "@/components/app/Avatar";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { timeAgo, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Home · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * HOME — "what's happening with us right now?"
 *
 * Explicitly not a dashboard. No KPI tiles, no five equal cards: the layout is
 * asymmetric and *which* room gets the big slot depends on what the group is actually
 * doing. A plan that needs decisions outranks a conversation, which outranks an idea
 * collecting hands — because that is the order in which things need a human.
 */
export default async function GroupHome({ params }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const { group, profile } = await requireGroup(slug);

  const [snapshot, members] = await Promise.all([
    getHomeSnapshot(group.id),
    getGroupMembers(group.id),
  ]);
  const memberAvatars = await resolveAvatars(members.map((m) => m.profile));

  const people = members.map(({ profile: p }) => ({
    id: p.id,
    name: p.display_name,
    url: memberAvatars.get(p.id) ?? null,
  }));

  // The one slot that gets to be big.
  const lead = snapshot.deciding
    ? ("align" as const)
    : snapshot.brewing
      ? ("tea" as const)
      : snapshot.rising
        ? ("one-day" as const)
        : null;

  const firstName = profile.display_name.split(" ")[0];

  return (
    <div className="home">
      <header className="home-top">
        <div>
          <p className="home-kicker">{group.name.toUpperCase()}</p>
          <h1 className="home-greeting">
            {lead ? (
              <>
                Your people have
                <br />
                <span>been busy.</span>
              </>
            ) : (
              <>
                It&apos;s quiet,
                <br />
                <span>{firstName}.</span>
              </>
            )}
          </h1>
        </div>
        <Link className="home-members" href={`/g/${slug}/members`}>
          <AvatarStack people={people} max={6} size={34} />
          <span>{members.length} in here</span>
        </Link>
      </header>

      <div className="home-grid">
        {/* ---------------------------------------------------------- lead slot */}
        {lead === "align" && snapshot.deciding && (
          <Link
            className="panel panel-lead"
            href={`/g/${slug}/align/${snapshot.deciding.id}`}
            style={{ ["--room" as string]: ROOM_BY_KEY.align.accent }}
          >
            <p className="panel-kicker">NEXT UP · ALIGN</p>
            <h2 className="panel-title">{snapshot.deciding.title}</h2>
            {snapshot.deciding.unresolved.length > 0 ? (
              <p className="panel-lead-line">
                Still deciding{" "}
                <strong>{snapshot.deciding.unresolved.join(", ")}</strong>.
              </p>
            ) : (
              <p className="panel-lead-line">Everything&apos;s answered. Lock it.</p>
            )}
            <p className="panel-foot">
              {snapshot.deciding.inCount}/{snapshot.memberCount} are in
              {snapshot.deciding.final_date
                ? ` · ${shortDate(snapshot.deciding.final_date)}`
                : ""}
            </p>
          </Link>
        )}

        {lead === "tea" && snapshot.brewing && (
          <Link
            className="panel panel-lead"
            href={`/g/${slug}/tea/${snapshot.brewing.id}`}
            style={{ ["--room" as string]: ROOM_BY_KEY.tea.accent }}
          >
            <p className="panel-kicker">BREWING RIGHT NOW · TEA</p>
            <h2 className="panel-title">{snapshot.brewing.title}</h2>
            <p className="panel-lead-line">
              {snapshot.brewing.messageCount === 0
                ? "Nobody's said anything yet."
                : `${snapshot.brewing.messageCount} messages deep.`}
            </p>
            <p className="panel-foot">
              started by {snapshot.brewing.author?.display_name ?? "someone"} ·{" "}
              {timeAgo(snapshot.brewing.updated_at)}
            </p>
          </Link>
        )}

        {lead === "one-day" && snapshot.rising && (
          <Link
            className="panel panel-lead"
            href={`/g/${slug}/one-day`}
            style={{ ["--room" as string]: ROOM_BY_KEY["one-day"].accent }}
          >
            <p className="panel-kicker">WE MIGHT ACTUALLY DO THIS · ONE DAY</p>
            <h2 className="panel-title">{snapshot.rising.title}</h2>
            <p className="panel-lead-line">
              {snapshot.rising.interested}/{snapshot.memberCount} are in.
            </p>
            <p className="panel-foot">{timeAgo(snapshot.rising.created_at)}</p>
          </Link>
        )}

        {!lead && (
          <div className="panel panel-lead panel-quiet">
            <p className="panel-kicker">NOTHING IS HAPPENING</p>
            <h2 className="panel-title">Suspiciously peaceful.</h2>
            <p className="panel-lead-line">
              Spill something in TEA, or put a someday in ONE DAY.
            </p>
            <p className="panel-foot">
              <Link href={`/g/${slug}/tea`}>Start the tea ↗</Link>
            </p>
          </div>
        )}

        {/* ------------------------------------------------------ supporting */}
        {lead !== "tea" && snapshot.brewing && (
          <Link
            className="panel"
            href={`/g/${slug}/tea/${snapshot.brewing.id}`}
            style={{ ["--room" as string]: ROOM_BY_KEY.tea.accent }}
          >
            <p className="panel-kicker">BREWING · TEA</p>
            <h3 className="panel-sub">{snapshot.brewing.title}</h3>
            <p className="panel-foot">
              {snapshot.brewing.messageCount} messages · {timeAgo(snapshot.brewing.updated_at)}
            </p>
          </Link>
        )}

        {lead !== "one-day" && snapshot.rising && (
          <Link
            className="panel"
            href={`/g/${slug}/one-day`}
            style={{ ["--room" as string]: ROOM_BY_KEY["one-day"].accent }}
          >
            <p className="panel-kicker">GAINING HANDS · ONE DAY</p>
            <h3 className="panel-sub">{snapshot.rising.title}</h3>
            <div className="panel-people">
              <AvatarStack
                people={snapshot.rising.people.map((p) => ({
                  id: p.id,
                  name: p.display_name,
                  url: snapshot.avatars.get(p.id) ?? null,
                }))}
                max={5}
                size={26}
              />
              <span>
                {snapshot.rising.interested}/{snapshot.memberCount} in
              </span>
            </div>
          </Link>
        )}

        {snapshot.making && (
          <Link
            className="panel"
            href={`/g/${slug}/create/${snapshot.making.id}`}
            style={{ ["--room" as string]: ROOM_BY_KEY.create.accent }}
          >
            <p className="panel-kicker">CURRENTLY MAKING · CREATE</p>
            <h3 className="panel-sub">{snapshot.making.title}</h3>
            <div className="panel-people">
              <AvatarStack
                people={snapshot.making.people.map((p) => ({
                  id: p.id,
                  name: p.display_name,
                  url: snapshot.avatars.get(p.id) ?? null,
                }))}
                max={5}
                size={26}
              />
              <span>
                {snapshot.making.people.length} down
              </span>
            </div>
          </Link>
        )}

        {snapshot.lastMemory && (
          <Link
            className="panel panel-memory"
            href={`/g/${slug}/vault/${snapshot.lastMemory.id}`}
            style={{ ["--room" as string]: ROOM_BY_KEY.vault.accent }}
          >
            <p className="panel-kicker">FROM THE VAULT</p>
            <h3 className="panel-sub">{snapshot.lastMemory.title}</h3>
            <p className="panel-foot">
              {snapshot.lastMemory.mediaCount}{" "}
              {snapshot.lastMemory.mediaCount === 1 ? "photo" : "photos"}
              {snapshot.lastMemory.memory_date
                ? ` · ${shortDate(snapshot.lastMemory.memory_date)}`
                : ""}
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
