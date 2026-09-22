import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup, getGroupMembers, roomContext } from "@/lib/data/session";
import { getHomeSnapshot, groupPulse } from "@/lib/data/home";
import { getActivity } from "@/lib/data/activity";
import { resolveAvatars } from "@/lib/data/media";
import { Avatar, AvatarStack } from "@/components/app/Avatar";
import { Count, firstName, toPeople } from "@/components/app/People";
import { ArrowUpRight, RoomGlyph } from "@/components/app/Icons";
import { Photo } from "@/components/app/Photo";
import { ROOM_BY_KEY, type RoomKey } from "@/lib/constants/rooms";
import { palette, tilt } from "@/lib/art";
import { timeAgo, shortDate, isoDaysAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Home · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/** Which room a line belongs to, said once, small, *after* the thing itself. */
function RoomTag({ room, children }: { room: RoomKey; children: React.ReactNode }) {
  return (
    <span className="room-tag" style={{ ["--room" as string]: ROOM_BY_KEY[room].accent }}>
      <RoomGlyph room={room} width={14} height={14} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * HOME: "what is happening with us right now?"
 *
 * Not a dashboard. One sentence about the group, derived from real counts; the
 * group's own photographs running under it like a contact strip; then one thing big
 * enough to act on (whatever most needs a human) with the rest of the house arranged
 * around it as objects (a ticket, a whisper, a photograph), not five equal boxes.
 */
export default async function GroupHome({ params }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const { groupId } = await roomContext(slug);

  const [{ profile }, snapshot, members, activity] = await Promise.all([
    requireGroup(slug),
    getHomeSnapshot(groupId),
    getGroupMembers(groupId),
    getActivity(groupId, slug, 24),
  ]);
  const memberAvatars = await resolveAvatars(members.map((m) => m.profile));
  const av = new Map([...memberAvatars, ...snapshot.avatars]);

  const weekAgo = isoDaysAgo(7);
  const activity7d = activity.filter((a) => a.at >= weekAgo).length;
  const pulse = groupPulse(snapshot, activity7d);

  // Who has been around lately, most recent first: the faces at the top of Home are
  // ordered by presence, not by alphabet or role.
  const lastSeen = new Map<string, string>();
  for (const item of activity) {
    if (item.who && !lastSeen.has(item.who)) lastSeen.set(item.who, item.at);
  }
  const everyone = members
    .map(({ profile: p }) => ({ p, seen: lastSeen.get(firstName(p.display_name)) ?? null }))
    .sort((a, b) => (b.seen ?? "").localeCompare(a.seen ?? ""));
  const around = everyone.filter((e) => e.seen);

  const { brewing, rising, deciding, upcoming, making, lastMemory, strip } = snapshot;
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

        <nav className="home-start" aria-label="Start something">
          <Link href={`${base}/tea?new=1`} style={{ ["--room" as string]: ROOM_BY_KEY.tea.accent }}>
            <RoomGlyph room="tea" width={16} height={16} aria-hidden="true" /> Drop a tea
          </Link>
          <Link href={`${base}/one-day?new=1`} style={{ ["--room" as string]: ROOM_BY_KEY["one-day"].accent }}>
            <RoomGlyph room="one-day" width={16} height={16} aria-hidden="true" /> Add a someday
          </Link>
          <Link href={`${base}/align?new=1`} style={{ ["--room" as string]: ROOM_BY_KEY.align.accent }}>
            <RoomGlyph room="align" width={16} height={16} aria-hidden="true" /> Start a plan
          </Link>
          <Link href={`${base}/create?new=1`} style={{ ["--room" as string]: ROOM_BY_KEY.create.accent }}>
            <RoomGlyph room="create" width={16} height={16} aria-hidden="true" /> Pin a make
          </Link>
          <Link href={`${base}/vault?new=1`} style={{ ["--room" as string]: ROOM_BY_KEY.vault.accent }}>
            <RoomGlyph room="vault" width={16} height={16} aria-hidden="true" /> Save a memory
          </Link>
        </nav>

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

      {/* -------------------------------------------------------------- the strip:
          the group's own photographs, newest memory first, each a way back in. */}
      {strip.length > 0 && (
        <section className="home-strip" aria-label="Recent photos from the vault">
          <ol className="strip">
            {strip.map((frame, i) => (
              <li key={frame.id} className="strip-frame" style={{ ["--i" as string]: i, ["--t" as string]: `${tilt(frame.id, 1.6)}deg` }}>
                <Link href={`${base}/vault/${frame.capsuleId}`} aria-label={`${frame.title}${frame.caption ? `: ${frame.caption}` : ""}`}>
                  <span className="strip-print">
                    <Photo src={frame.url} sizes="(max-width: 640px) 40vw, 220px" priority={i < 3} />
                  </span>
                  {/* The memory's name once, on its first print; its captions after that. */}
                  <span className="strip-caption" aria-hidden="true" data-first={strip[i - 1]?.capsuleId !== frame.capsuleId}>
                    {strip[i - 1]?.capsuleId !== frame.capsuleId ? frame.title : (frame.caption ?? " ")}
                  </span>
                </Link>
              </li>
            ))}
            <li className="strip-end">
              <Link href={`${base}/vault`} className="go">
                Everything we kept <ArrowUpRight className="btn-arrow" width={14} height={14} />
              </Link>
            </li>
          </ol>
        </section>
      )}

      <div className="home-body">
        {/* ------------------------------------------------------------ the one big thing */}
        <section className="home-now" aria-label="Needs you now">
          {lead === "upcoming" && upcoming && (
            <Link className="now now-ticket" href={`${base}/align/${upcoming.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.align.accent }}>
              <h2 className="display now-title">{upcoming.title}</h2>
              <div className="now-ticket-facts">
                {upcoming.final_date && <span className="display">{shortDate(upcoming.final_date)}</span>}
                {upcoming.final_location && <span className="display">{upcoming.final_location}</span>}
              </div>
              <Count people={toPeople(upcoming.people, av)} total={snapshot.memberCount} label="going" />
              <RoomTag room="align">Locked in Align. It&apos;s happening.</RoomTag>
            </Link>
          )}

          {lead === "deciding" && deciding && (
            <Link className="now now-plan" href={`${base}/align/${deciding.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.align.accent }}>
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
              <RoomTag room="align">We might actually do this</RoomTag>
            </Link>
          )}

          {lead === "brewing" && brewing && (
            <Link className="now now-tea" href={`${base}/tea/${brewing.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.tea.accent }}>
              <h2 className="display now-title">{brewing.title}</h2>
              {brewing.last && (
                <blockquote className="now-quote">
                  <p>{brewing.last.content}</p>
                  <cite>{brewing.last.author}, {timeAgo(brewing.last.at)}</cite>
                </blockquote>
              )}
              <span className="now-foot">
                <AvatarStack people={toPeople(brewing.voices, av)} max={5} size={26} />
                <RoomTag room="tea">Brewing, {brewing.messageCount} messages deep</RoomTag>
              </span>
            </Link>
          )}

          {lead === "rising" && rising && (
            <Link className="now now-idea" href={`${base}/one-day/${rising.id}`} style={{ ["--room" as string]: ROOM_BY_KEY["one-day"].accent }}>
              <h2 className="display now-title">{rising.title}</h2>
              <Count people={toPeople(rising.people, av)} total={snapshot.memberCount} label="are in" />
              {rising.holdout && <p className="lede">Someone convince {rising.holdout}.</p>}
              <RoomTag room="one-day">Gaining hands in One Day</RoomTag>
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
        <aside className="home-lately" aria-labelledby="lately-h">
          <h2 className="section-title" id="lately-h">Lately</h2>
          {activity.length === 0 ? (
            <p className="lede">Nothing in three weeks. The group chat is winning.</p>
          ) : (
            <ol className="lately-list">
              {activity.slice(0, 7).map((item) => (
                <li key={item.id} style={{ ["--room" as string]: ROOM_BY_KEY[item.room].accent }}>
                  <Link href={item.href}>
                    <RoomGlyph room={item.room} className="lately-glyph" width={15} height={15} aria-hidden="true" />
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
      </div>

      {/* ------------------------------------------------------------ the rest of the house */}
      <div className="home-house">
        {lastMemory && (
          <Link className="house-memory" href={`${base}/vault/${lastMemory.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.vault.accent }}>
            <span className="house-memory-frame">
              <Photo src={lastMemory.coverUrl} sizes="(max-width: 960px) 100vw, 40vw" />
            </span>
            <span className="house-memory-text">
              <span className="display house-memory-title">{lastMemory.title}</span>
              <span className="meta">
                {lastMemory.memory_date ? shortDate(lastMemory.memory_date) : "undated"}, {lastMemory.mediaCount} photos
                {lastMemory.people.length > 0 && `, ${lastMemory.people.length} there`}
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
                <span className="display house-ticket-title">{rising.title}</span>
                {rising.holdout && <span className="house-ticket-note">Someone convince {rising.holdout}.</span>}
                <span className="house-ticket-kind">One day, we should</span>
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
            <span className="display house-whisper-title">{brewing.title}</span>
            {brewing.last && (
              <span className="house-whisper-last">
                <b>{brewing.last.author}:</b> {brewing.last.content}
              </span>
            )}
            <RoomTag room="tea">Still brewing</RoomTag>
          </Link>
        )}

        {making && (
          <Link className="house-make" href={`${base}/create/${making.id}`} style={{ ["--room" as string]: ROOM_BY_KEY.create.accent }}>
            <span className="display house-make-title">{making.title}</span>
            <span className="house-make-crew">
              {making.people.length > 0 && <AvatarStack people={toPeople(making.people, av)} max={5} size={24} />}
              <RoomTag room="create">
                {making.people.length === 0 ? "In the studio, nobody's down yet" : `In the studio, ${making.people.length} down`}
              </RoomTag>
            </span>
          </Link>
        )}
      </div>

      <p className="sr-only">Signed in as {profile.display_name}</p>
    </div>
  );
}
