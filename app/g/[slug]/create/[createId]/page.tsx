import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { getCreation } from "@/lib/data/create";
import { Avatar } from "@/components/app/Avatar";
import { ArrowLeft, ArrowUpRight } from "@/components/app/Icons";
import { firstName, toPeople } from "@/components/app/People";
import { JoinCrew, Lifecycle, RolePicker } from "@/components/create/CrewControls";
import { Reference } from "@/components/create/Reference";
import { CREATE_ROLE_LABEL, referenceHost } from "@/lib/constants/create";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Create · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * One make. The reference on the left, big — it is the brief. On the right: what it
 * is, who's down and doing what, and a strip of film frames for where it's up to,
 * with only the next move as a button. Once it's out, the result goes up beside
 * the reference: what we wanted, and what we made.
 */
export default async function CreationDetail({ params }: PageProps<"/g/[slug]/create/[createId]">) {
  const { slug, createId } = await params;
  const { group, profile } = await requireGroup(slug);
  const { creation, avatars } = await getCreation(createId, profile.id);

  if (!creation || creation.group_id !== group.id) notFound();

  const crew = creation.crew.filter((m) => m.status === "in");
  const me = { id: profile.id, name: profile.display_name, url: avatars.get(profile.id) ?? null };
  const host = referenceHost(creation.reference_url);
  const finished = creation.status === "posted" || creation.status === "completed";

  return (
    <div className="make-detail">
      <Link className="back" href={`/g/${slug}/create`}>
        <ArrowLeft /> The studio
      </Link>

      <div className="make-detail-grid">
        <div className="make-detail-media">
          <figure className="make-figure">
            <Reference id={creation.id} url={creation.reference_url} title={creation.title} size="large" />
            <figcaption>
              {creation.reference_url ? (
                <a className="go" href={creation.reference_url} target="_blank" rel="noopener noreferrer">
                  The reference{host ? ` · ${host}` : ""} <ArrowUpRight className="btn-arrow" width={14} height={14} />
                </a>
              ) : (
                <span className="meta">No reference — it&apos;s all in someone&apos;s head.</span>
              )}
            </figcaption>
          </figure>

          {finished && creation.result_url && (
            <figure className="make-figure make-result">
              <Reference id={`${creation.id}-result`} url={creation.result_url} title={creation.title} size="large" />
              <figcaption>
                <a className="go" href={creation.result_url} target="_blank" rel="noopener noreferrer">
                  What we made · {referenceHost(creation.result_url)} <ArrowUpRight className="btn-arrow" width={14} height={14} />
                </a>
              </figcaption>
            </figure>
          )}
        </div>

        <div className="make-detail-side">
          <p className="meta">
            {creation.author?.display_name ?? "Someone"} pinned this {timeAgo(creation.created_at)}
          </p>
          <h1 className="display make-detail-title">{creation.title}</h1>
          {creation.description && <p className="lede">{creation.description}</p>}

          <JoinCrew createId={creation.id} slug={slug} me={me} crew={toPeople(crew.map((m) => m.profile), avatars)} />

          {creation.mine?.status === "in" && (
            <div className="field">
              <span className="field-label">You&apos;re on…</span>
              <RolePicker createId={creation.id} slug={slug} role={creation.mine.role} />
            </div>
          )}

          {crew.some((m) => m.role) && (
            <ul className="crew-roles">
              {crew
                .filter((m) => m.role)
                .map((m) => (
                  <li key={m.profile.id}>
                    <Avatar url={avatars.get(m.profile.id) ?? null} name={m.profile.display_name} size={26} />
                    <span>{firstName(m.profile.display_name)}</span>
                    <b>{CREATE_ROLE_LABEL[m.role!]}</b>
                  </li>
                ))}
            </ul>
          )}

          <Lifecycle createId={creation.id} slug={slug} status={creation.status} planId={creation.planId} crewCount={crew.length} />
        </div>
      </div>
    </div>
  );
}
