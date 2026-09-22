import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { listCreations, type CreationSummary } from "@/lib/data/create";
import { AvatarStack } from "@/components/app/Avatar";
import { firstName, toPeople } from "@/components/app/People";
import { AddCreation } from "@/components/create/AddCreation";
import { Reference } from "@/components/create/Reference";
import { CREATE_ROLE_LABEL, CREATE_STATUS_LABEL } from "@/lib/constants/create";
import { tilt } from "@/lib/art";

export const metadata: Metadata = { title: "Create · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * CREATE — friends making things together.
 *
 * A studio wall. Every make is its reference — the actual frame of the reel, or a
 * slip with the source written on it — pinned up at a size that depends on where it
 * is in the wall, with the crew and their roles scribbled underneath. Where it is
 * up to is one quiet word, not a Kanban column.
 */
export default async function CreatePage({ params, searchParams }: PageProps<"/g/[slug]/create">) {
  const { slug } = await params;
  const { new: wantsNew } = await searchParams;
  const { group, profile } = await requireGroup(slug);
  const { live, shipped, avatars } = await listCreations(group.id, profile.id);
  const base = `/g/${slug}/create`;

  const crewLine = (c: CreationSummary) => {
    const withRoles = c.crew.filter((m) => m.status === "in" && m.role);
    if (withRoles.length === 0) return null;
    return withRoles
      .slice(0, 3)
      .map((m) => `${CREATE_ROLE_LABEL[m.role!]}: ${firstName(m.profile.display_name)}`)
      .join(" · ");
  };

  return (
    <div className="studio">
      <header className="room-intro">
        <h1 className="display studio-title">
          The <span>studio</span>
        </h1>
        <AddCreation groupId={group.id} slug={slug} defaultOpen={wantsNew === "1"} />
      </header>

      {live.length === 0 && shipped.length === 0 && (
        <div className="empty">
          <p className="empty-line">Someone needs to send a reel.</p>
          <p className="empty-hint">Paste a reference, say what you want to make, see who&apos;s down.</p>
        </div>
      )}

      {live.length > 0 && (
        <section className="studio-wall" aria-label="Being made">
          {live.map((c, i) => {
            const crew = c.crew.filter((m) => m.status === "in");
            return (
              <Link
                key={c.id}
                href={`${base}/${c.id}`}
                className="make"
                data-size={i === 0 ? "lead" : i % 3 === 2 ? "tall" : "base"}
                style={{ ["--t" as string]: `${i === 0 ? 0 : tilt(c.id, 1.4)}deg` }}
              >
                <Reference id={c.id} url={c.reference_url} title={c.title} size={i === 0 ? "large" : "base"} />
                <span className="make-text">
                  <span className="make-status">{CREATE_STATUS_LABEL[c.status]}</span>
                  <span className="display make-title">{c.title}</span>
                  {i === 0 && c.description && <span className="make-desc">{c.description}</span>}
                  <span className="make-crew">
                    {crew.length > 0 && <AvatarStack people={toPeople(crew.map((m) => m.profile), avatars)} max={5} size={24} />}
                    <span className="make-roles">{crewLine(c) ?? (crew.length === 0 ? "nobody's down yet" : `${crew.length} down`)}</span>
                  </span>
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {shipped.length > 0 && (
        <section className="studio-shipped" aria-labelledby="shipped-h">
          <h2 className="section-title" id="shipped-h">
            We actually made these <span className="meta">{shipped.length}</span>
          </h2>
          <ul>
            {shipped.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/${c.id}`} className="shipped">
                  <Reference id={c.id} url={c.result_url ?? c.reference_url} title={c.title} />
                  <span className="display">{c.title}</span>
                  <span className="meta">{c.status === "posted" ? "posted" : "done"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
