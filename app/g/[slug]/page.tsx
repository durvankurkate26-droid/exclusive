import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup, getGroupMembers } from "@/lib/data/session";
import { getHomeSnapshot, groupPulse } from "@/lib/data/home";
import { getActivity } from "@/lib/data/activity";
import { resolveAvatars } from "@/lib/data/media";
import { Avatar, AvatarStack } from "@/components/app/Avatar";
import { Count, firstName, toPeople } from "@/components/app/People";
import { ArrowUpRight } from "@/components/app/Icons";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { palette, tilt } from "@/lib/art";
import { timeAgo, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Home · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * HOME — "what is happening with us right now?"
 *
 * Not a dashboard. One sentence about the group, derived from real counts; then one
 * thing big enough to act on (whatever most needs a human); then the rest of the
 * house arranged around it as objects — a ticket, a quote, a photograph — not five
 * equal boxes. The pulse down the side is what makes it feel like people are here.
 */
export default async function GroupHome({ params }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const { group, profile } = await requireGroup(slug);

  const [snapshot, members, activity] = await Promise.all([
    getHomeSnapshot(group.id),
    getGroupMembers(group.id),
    getActivity(group.id, slug, 24),
  ]);
  const memberAvatars = await resolveAvatars(members.map((m) => m.profile));
  const av = new Map([...memberAvatars, ...snapshot.avatars]);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const activity7d = activity.filter((a) => a.at >= weekAgo).length;
  const pulse = groupPulse(snapshot, activity7d);

  // Who has been around lately, most recent first — the faces at the top of Home are
  // ordered by presence, not by alphabet or role.
  const lastSeen = new Map<string, string>();
  for (const item of activity) {
    if (item.who && !lastSeen.has(item.who)) lastSeen.set(item.who, item.at);
  }
  const everyone = members
    .map(({ profile: p }) => ({ p, seen: lastSeen.get(firstName(p.display_name)) ?? null }))
    .sort((a, b) => (b.seen ?? "").localeCompare(a.seen ?? ""));
  const around = everyone.filter((e) => e.seen);

  const { brewing, rising, deciding, upcoming, making, lastMemory } = snapshot;
  const lead = upcoming ? "upcoming" : deciding ? "deciding" : brewing ? "brewing" : rising ? "rising" : null;
  const base = `/g/${slug}`;

  return (
    <div className="home">
      {/* -------------------------------------------------------------- the pulse */}
      <section className="home-hero" style={{ ["--line-room" as string]: ROOM_BY_KEY[pulse.room].accent }}>
        <h1 className="display home-statement">
          <span>{pulse.lines[0]}</span>
          <span className="home-statement-lit">{pulse.lines[1]}</span>
        </h1>

        <p className="home-start">
          <span className="home-start-label">Start something —</span>{" "}
          <Link href={`${base}/tea?new=1`}>drop a tea</Link>
          <Link href={`${base}/one-day?new=1`}>add a someday</Link>
          <Link href={`${base}/align?new=1`}>start a plan</Link>
          <Link href={`${base}/create?new=1`}>pin a make</Link>
          <Link href={`${base}/vault?new=1`}>save a memory</Link>
        </p>

        <Link className="home-around" href={`${base}/members`}>
          <span className="home-around-faces">
            {everyone.slice(0, 9).map(({ p, seen }, i) => (
              <span
                key={p.id}
                className="home-face"
                data-seen={Boolean(seen)}
                style={{ ["--i" as string]: i }}
                title={p.display_name}
              >
                <Avatar url={av.get(p.id) ?? null} name={p.display_name} size={i === 0 ? 56 : i < 3 ? 44 : 34} />
              </span>
            ))}
          </span>
          <span className="home-around-line">
            {around.length === 0
              ? `${members.length} of you, all quiet`
              : around.length === 1
                ? `${firstName(around[0].p.display_name)} was just here`
                : `${firstName(around[0].p.display_name)}, ${firstName(around[1].p.display_name)}${around.length > 2 ? ` and ${around.length - 2} more` : ""} have been around`}
          </span>
        </Link>
      </section>

      <div className="home-body">
        {/* ------------------------------------------------------------ the one big thing */}
        <section className="home-now" aria-label="Needs you now">
          {lead === "upcoming" && upcoming && (
            <Link className="now now-ticket" href={`${base}/align/${upcoming.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.align.accent }}>
              <span className="now-where">NEXT UP · IT&apos;S HAPPENING</span>
              <h2 className="display now-title">{upcoming.title}</h2>
              <div className="now-ticket-facts">
                {upcoming.final_date && <span className="display">{shortDate(upcoming.final_date)}</span>}
                {upcoming.final_location && <span className="display">{upcoming.final_location}</span>}
              </div>
              <Count people={toPeople(upcoming.people, av)} total={snapshot.memberCount} label="going" />
            </Link>
          )}

          {lead === "deciding" && deciding && (
            <Link className="now now-plan" href={`${base}/align/${deciding.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.align.accent }}>
              <span className="now-where">WE MIGHT ACTUALLY DO THIS · ALIGN</span>
              <h2 className="display now-title">{deciding.title}</h2>
              <ul className="now-blockers" aria-label="What's still open">
                {[
                  { key: "date", label: deciding.leadingDate ? shortDate(deciding.leadingDate) : "WHEN?", open: deciding.unresolved.includes("date") },
                  { key: "place", label: deciding.leadingPlace ?? "WHERE?", open: deciding.unresolved.includes("place") },
                  { key: "who", label: `${deciding.inCount}/${snapshot.memberCount} IN`, open: deciding.unresolved.includes("who's coming") },
                ].map((b, i) => (
                  <li key={b.key} data-open={b.open} style={{ ["--t" as string]: `${b.open ? tilt(deciding.id + b.key, 2.4) : 0}deg`, ["--i" as string]: i }}>
                    {b.label}
                  </li>
                ))}
              </ul>
              <p className="lede">
                {deciding.unresolved.length === 0
                  ? "Everything has an answer. Somebody just has to lock it."
                  : `Still stuck on ${deciding.unresolved.join(" and ")}.`}{" "}
                <span className="go">Go sort it <ArrowUpRight className="btn-arrow" width={14} height={14} /></span>
              </p>
            </Link>
          )}

          {lead === "brewing" && brewing && (
            <Link className="now now-tea" href={`${base}/tea/${brewing.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.tea.accent }}>
              <span className="now-where">BREWING RIGHT NOW · TEA</span>
              <h2 className="display now-title">{brewing.title}</h2>
              {brewing.last && (
                <blockquote className="now-quote">
                  <p>{brewing.last.content}</p>
                  <cite>— {brewing.last.author}, {timeAgo(brewing.last.at)}</cite>
                </blockquote>
              )}
              <span className="now-foot">
                <AvatarStack people={toPeople(brewing.voices, av)} max={5} size={26} />
                <span className="meta">{brewing.messageCount} messages deep</span>
              </span>
            </Link>
          )}

          {lead === "rising" && rising && (
            <Link className="now now-idea" href={`${base}/one-day/${rising.id}`} style={{ ["--room" as string]: ROOM_BY_KEY["one-day"].accent }}>
              <span className="now-where">GAINING HANDS · ONE DAY</span>
              <h2 className="display now-title">{rising.title}</h2>
              <Count people={toPeople(rising.people, av)} total={snapshot.memberCount} label="are in" />
              {rising.holdout && <p className="lede">Someone convince {rising.holdout}.</p>}
            </Link>
          )}

          {!lead && (
            <div className="now now-quiet">
              <h2 className="display now-title">Nothing needs anyone.</h2>
              <p className="lede">
                Which is suspicious. <Link href={`${base}/tea?new=1`}>Drop a tea</Link> or{" "}
                <Link href={`${base}/one-day?new=1`}>put a someday on the wall</Link>.
              </p>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------ lately */}
        <aside className="home-lately" aria-label="Lately">
          <h2 className="section-title">Lately</h2>
          {activity.length === 0 ? (
            <p className="lede">Nothing in three weeks. The group chat is winning.</p>
          ) : (
            <ol className="lately-list">
              {activity.slice(0, 8).map((item) => (
                <li key={item.id} style={{ ["--dot" as string]: ROOM_BY_KEY[item.room].accent }}>
                  <Link href={item.href}>
                    <span className="lately-dot" aria-hidden="true" />
                    <span className="lately-text">
                      {item.who && <strong>{item.who}</strong>} {item.text}
                    </span>
                    <time className="meta" dateTime={item.at}>{timeAgo(item.at)}</time>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </aside>

        {/* ------------------------------------------------------------ the rest of the house */}
        <div className="home-house">
          {lastMemory && (
            <Link className="house-memory" href={`${base}/vault/${lastMemory.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.vault.accent }}>
              <span className="house-memory-frame" data-empty={!lastMemory.coverUrl}>
                {lastMemory.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lastMemory.coverUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="house-memory-plate" aria-hidden="true">
                    {lastMemory.memory_date ? new Date(lastMemory.memory_date).getDate() : "—"}
                  </span>
                )}
              </span>
              <span className="house-memory-text">
                <span className="now-where">FROM THE VAULT</span>
                <span className="display house-memory-title">{lastMemory.title}</span>
                <span className="meta">
                  {lastMemory.memory_date ? shortDate(lastMemory.memory_date) : "undated"} ·{" "}
                  {lastMemory.mediaCount === 0 ? "no photos yet" : `${lastMemory.mediaCount} photos`}
                </span>
              </span>
            </Link>
          )}

          {rising && lead !== "rising" && (() => {
            const colors = palette(rising.id);
            return (
              <Link
                className="house-ticket"
                href={`${base}/one-day/${rising.id}`}
                style={{
                  ["--t" as string]: `${tilt(rising.id)}deg`,
                  ["--ground" as string]: colors.ground,
                  ["--light" as string]: colors.light,
                  ["--ink" as string]: colors.ink,
                }}
              >
                <span className="house-ticket-main">
                  <span className="house-ticket-kind">ONE DAY</span>
                  <span className="display house-ticket-title">{rising.title}</span>
                  {rising.holdout && <span className="house-ticket-note">Someone convince {rising.holdout}.</span>}
                </span>
                <span className="house-ticket-stub">
                  <b className="display">{rising.interested}/{snapshot.memberCount}</b>
                  <span>ARE IN</span>
                </span>
              </Link>
            );
          })()}

          {brewing && lead !== "brewing" && (
            <Link className="house-whisper" href={`${base}/tea/${brewing.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.tea.accent }}>
              <span className="now-where">BREWING · TEA</span>
              <span className="display house-whisper-title">{brewing.title}</span>
              {brewing.last && (
                <span className="house-whisper-last">
                  <b>{brewing.last.author}:</b> {brewing.last.content}
                </span>
              )}
            </Link>
          )}

          {making && (
            <Link className="house-make" href={`${base}/create/${making.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.create.accent }}>
              <span className="now-where">CURRENTLY MAKING</span>
              <span className="display house-make-title">{making.title}</span>
              <span className="house-make-crew">
                {making.people.length > 0 && <AvatarStack people={toPeople(making.people, av)} max={5} size={24} />}
                <span className="meta">
                  {making.people.length === 0 ? "nobody's down yet" : `${making.people.length} ${making.people.length === 1 ? "person is" : "people are"} down`}
                </span>
              </span>
            </Link>
          )}
        </div>
      </div>

      <p className="home-sign sr-only">Signed in as {profile.display_name}</p>
    </div>
  );
}
