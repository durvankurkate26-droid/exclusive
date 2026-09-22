import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { listCapsules, type CapsuleSummary } from "@/lib/data/vault";
import { Avatar, AvatarStack } from "@/components/app/Avatar";
import { firstName, toPeople } from "@/components/app/People";
import { CreateCapsule } from "@/components/vault/CreateCapsule";
import { OlderRail } from "@/components/vault/OlderRail";
import { tilt } from "@/lib/art";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Vault · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const RECENT = 4;

const monthDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase() : "UNDATED";

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
  const { group } = await requireGroup(slug);
  const { capsules: all, avatars } = await listCapsules(group.id);

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
  const recent = rest.slice(0, RECENT);
  const older = rest.slice(RECENT);

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
            Every capsule holds the photos, who was there and the things people said — somewhere they won&apos;t get
            buried under 400 messages.
          </p>
          <CreateCapsule groupId={group.id} slug={slug} defaultOpen={wantsNew === "1"} />
        </div>
      </div>
    );
  }

  return (
    <div className="vault">
      {/* -------------------------------------------------------------- the memory */}
      {featured && (
        <Link className="vault-feature" href={`${base}/${featured.id}`} data-empty={!featured.coverUrl}>
          <span className="vault-feature-image" aria-hidden="true">
            {featured.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featured.coverUrl} alt="" decoding="async" fetchPriority="high" />
            ) : (
              <span className="film-leader">
                <b>{featured.memory_date ? new Date(featured.memory_date).getDate() : "∞"}</b>
                <i>{featured.memory_date ? new Date(featured.memory_date).toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase() : "SOMETIME"}</i>
              </span>
            )}
          </span>
          <span className="vault-feature-text">
            <span className="meta vault-feature-date">
              {featured.memory_date ? shortDate(featured.memory_date) : "Undated"} ·{" "}
              {featured.mediaCount === 0 ? "no photos yet" : `${featured.mediaCount} photos`}
            </span>
            <span className="display vault-feature-title">{featured.title}</span>
            {featured.fragment && (
              <span className="vault-feature-quote">
                “{featured.fragment.note}” <em>— {firstName(featured.fragment.author?.display_name)}</em>
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
          Every memory with <strong>{firstName(whoName)}</strong> in it — {capsules.length}.{" "}
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
                      {m.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt="" loading="lazy" decoding="async" />
                      )}
                    </span>
                  ))
                ) : (
                  <span className="stack-print stack-print-empty" style={{ ["--r" as string]: "0deg", ["--j" as string]: 0 }}>
                    <span className="film-leader film-leader-sm">
                      <b>{c.memory_date ? new Date(c.memory_date).getDate() : "—"}</b>
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
