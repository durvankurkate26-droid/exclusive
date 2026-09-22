import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup, roomContext } from "@/lib/data/session";
import { listCapsules, type CapsuleSummary } from "@/lib/data/vault";
import { Avatar, AvatarStack } from "@/components/app/Avatar";
import { firstName, toPeople } from "@/components/app/People";
import { CreateCapsule } from "@/components/vault/CreateCapsule";
import { OlderRail } from "@/components/vault/OlderRail";
import { Photo } from "@/components/app/Photo";
import { tilt } from "@/lib/art";
import { dayMonth, dayOfMonth, monthYear, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Vault · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const RECENT = 4;

const monthDay = (iso: string | null) => (iso ? dayMonth(iso) : "UNDATED");

/**
 * VAULT — don't browse files, enter a memory.
 *
 * The newest memory is not a card, it is the room: full-bleed, its photograph
 * carrying the page, its title set over the image. Behind it the recent ones sit as
 * little stacks of prints; older ones become a row of spines in a box. A thin
 * timeline and a row of faces let you walk the archive by *when* and by *who* —
 * the two ways anyone actually remembers anything.
 */
export default async function VaultPage({ params, searchParams }: PageProps<"/g/[slug]/vault">) {
  const { slug } = await params;
  const { new: wantsNew, who } = await searchParams;
  const { groupId } = await roomContext(slug);
  const [{ group }, { capsules: all, avatars }] = await Promise.all([requireGroup(slug), listCapsules(groupId)]);

  // Everyone who appears in any memory, most-remembered first.
  const faceCount = new Map<string, { profile: CapsuleSummary["people"][number]; n: number }>();
  for (const c of all) {
    for (const p of c.people) {
      const entry = faceCount.get(p.id);
      if (entry) entry.n += 1;
      else faceCount.set(p.id, { profile: p, n: 1 });
    }
  }
  const faces = [...faceCount.values()].sort((a, b) => b.n - a.n);

  const whoId = typeof who === "string" ? who : null;
  const whoName = whoId ? faceCount.get(whoId)?.profile.display_name : null;
  const capsules = whoId ? all.filter((c) => c.people.some((p) => p.id === whoId)) : all;

  // The featured slot is for a photograph: the newest memory that has one, falling
  // back to the newest memory only when nothing has been uploaded anywhere yet.
  const featured = capsules.find((c) => c.coverUrl) ?? capsules[0];
  const rest = capsules.filter((c) => c !== featured);
  // Photographs lead. A memory nobody has added photos to yet is still a memory, but
  // it waits in its own quiet row rather than taking a big slot as an empty frame.
  const photographed = rest.filter((c) => c.mediaCount > 0);
  const waiting = rest.filter((c) => c.mediaCount === 0);
  const recent = photographed.slice(0, RECENT);
  const older = photographed.slice(RECENT);

  // Timeline: every capsule with a date, grouped by year, oldest on the left.
  const dated = [...all].filter((c) => c.memory_date).sort((a, b) => a.memory_date!.localeCompare(b.memory_date!));
  const years = [...new Set(dated.map((c) => c.memory_date!.slice(0, 4)))];

  const base = `/g/${slug}/vault`;

  if (all.length === 0) {
    return (
      <div className="vault">
        <div className="vault-empty">
          <p className="empty-line">
            Go make a memory.
            <span>Then bring it back here.</span>
          </p>
          <p className="empty-hint">
            Every capsule holds the photos, who was there and the things people said, somewhere they won&apos;t get
            buried under 400 messages.
          </p>
          <CreateCapsule groupId={group.id} slug={slug} defaultOpen={wantsNew === "1"} />
        </div>
      </div>
    );
  }

  return (
    <div className="vault">
      <h1 className="sr-only">The vault</h1>
      {/* -------------------------------------------------------------- the memory */}
      {featured && (
        <Link className="vault-feature" href={`${base}/${featured.id}`} data-empty={!featured.coverUrl}>
          <span className="vault-feature-image" aria-hidden="true">
            {featured.coverUrl ? (
              <Photo src={featured.coverUrl} sizes="100vw" priority />
            ) : (
              <span className="film-leader">
                <b>{featured.memory_date ? dayOfMonth(featured.memory_date) : "∞"}</b>
                <i>{featured.memory_date ? monthYear(featured.memory_date) : "SOMETIME"}</i>
              </span>
            )}
          </span>
          <span className="vault-feature-text">
            <span className="meta vault-feature-date">
              {featured.memory_date ? shortDate(featured.memory_date) : "Undated"} ·{" "}
              {featured.mediaCount === 0 ? "no photos yet" : `${featured.mediaCount} photos`}
            </span>
            <h2 className="display vault-feature-title">{featured.title}</h2>
            {featured.fragment && (
              <span className="vault-feature-quote">
                “{featured.fragment.note}” <em>{firstName(featured.fragment.author?.display_name)}</em>
              </span>
            )}
            {featured.people.length > 0 && (
              <span className="vault-feature-people">
                <AvatarStack people={toPeople(featured.people, avatars)} max={7} size={30} />
              </span>
            )}
          </span>
        </Link>
      )}

      {/* -------------------------------------------------------------- walk the archive */}
      <nav className="vault-ways" aria-label="Walk the vault">
        {years.length > 0 && (
          <ol className="timeline" aria-label="Timeline">
            {years.map((year) => (
              <li key={year} className="timeline-year">
                <span className="display">{year}</span>
                <span className="timeline-line">
                  {dated
                    .filter((c) => c.memory_date!.startsWith(year))
                    .map((c) => {
                      const d = new Date(c.memory_date!);
                      const pos = ((d.getMonth() * 30.4 + d.getDate()) / 366) * 100;
                      return (
                        <Link
                          key={c.id}
                          href={`${base}/${c.id}`}
                          className="timeline-node"
                          style={{ left: `${pos}%` }}
                          aria-label={`${c.title}, ${shortDate(c.memory_date!)}`}
                        >
                          <span className="timeline-tip">
                            <b>{c.title}</b> {monthDay(c.memory_date)}
                          </span>
                        </Link>
                      );
                    })}
                </span>
              </li>
            ))}
          </ol>
        )}

        {faces.length > 0 && (
          <div className="vault-faces" aria-label="Filter by person">
            {whoId && (
              <Link className="vault-face-clear" href={base}>
                Everyone
              </Link>
            )}
            {faces.map(({ profile: p, n }) => (
              <Link
                key={p.id}
                href={whoId === p.id ? base : `${base}?who=${p.id}`}
                className="vault-face"
                data-on={whoId === p.id}
                aria-current={whoId === p.id ? "true" : undefined}
                title={`${p.display_name} · ${n} ${n === 1 ? "memory" : "memories"}`}
              >
                <Avatar url={avatars.get(p.id) ?? null} name={p.display_name} size={36} />
                <span className="sr-only">
                  {p.display_name}, {n} {n === 1 ? "memory" : "memories"}
                </span>
              </Link>
            ))}
          </div>
        )}

        <CreateCapsule groupId={group.id} slug={slug} defaultOpen={wantsNew === "1"} variant="quiet" />
      </nav>

      {whoName && (
        <p className="vault-filter-line">
          Every memory with <strong>{firstName(whoName)}</strong> in it: {capsules.length}.{" "}
          <Link href={base}>Show everyone</Link>
        </p>
      )}

      {/* -------------------------------------------------------------- recent stacks */}
      {recent.length > 0 && (
        <section className="vault-recent" aria-label="Recent memories">
          {recent.map((c, i) => (
            <Link key={c.id} href={`${base}/${c.id}`} className="stack" data-size={i === 0 ? "wide" : i === 3 ? "tall" : "base"}>
              <span className="stack-prints" aria-hidden="true">
                {c.previews.length > 0 ? (
                  // The cover leads the stack; the prints behind it are the others.
                  [...c.previews]
                    .sort((x, y) => Number(y.storage_path === c.cover_url) - Number(x.storage_path === c.cover_url))
                    .slice(0, 3)
                    .map((m, j) => (
                    <span
                      key={m.id}
                      className="stack-print"
                      style={{ ["--r" as string]: `${j === 0 ? 0 : tilt(m.id, 5)}deg`, ["--j" as string]: j }}
                    >
                      <Photo src={m.url} eager={i === 0} sizes={i === 0 ? "(max-width: 900px) 100vw, 60vw" : "(max-width: 900px) 50vw, 35vw"} />
                    </span>
                  ))
                ) : (
                  <span className="stack-print stack-print-empty" style={{ ["--r" as string]: "0deg", ["--j" as string]: 0 }}>
                    <span className="film-leader film-leader-sm">
                      <b>{c.memory_date ? dayOfMonth(c.memory_date) : "?"}</b>
                    </span>
                  </span>
                )}
              </span>
              <span className="stack-caption">
                <span className="display stack-title">{c.title}</span>
                <span className="meta">
                  {monthDay(c.memory_date)} · {c.mediaCount === 0 ? "waiting for photos" : `${c.mediaCount} photos`}
                </span>
                {c.fragment && <span className="stack-quote">“{c.fragment.note}”</span>}
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* -------------------------------------------------------------- still waiting */}
      {waiting.length > 0 && (
        <section className="vault-waiting" aria-labelledby="waiting-h">
          <h2 className="section-title" id="waiting-h">
            Waiting for photos <span className="meta">{waiting.length}</span>
          </h2>
          <ul>
            {waiting.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/${c.id}`} className="waiting">
                  <span className="waiting-plate" aria-hidden="true">
                    {c.memory_date ? dayOfMonth(c.memory_date) : "?"}
                  </span>
                  <span className="waiting-text">
                    <span className="display">{c.title}</span>
                    <span className="meta">
                      {monthDay(c.memory_date)}
                      {c.people.length > 0 && `, ${c.people.length} were there`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* -------------------------------------------------------------- the box */}
      {older.length > 0 && (
        <section className="vault-older" aria-labelledby="older-h">
          <h2 className="section-title" id="older-h">
            Older moments <span className="meta">{older.length}</span>
          </h2>
          <OlderRail
            items={older.map((c) => ({
              id: c.id,
              title: c.title,
              date: monthDay(c.memory_date),
              cover: c.coverUrl,
              href: `${base}/${c.id}`,
            }))}
          />
        </section>
      )}
    </div>
  );
}
