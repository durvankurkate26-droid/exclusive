import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { getCreation } from "@/lib/data/create";
import { CREATE_ROLE_LABEL, referenceHost } from "@/lib/constants/create";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { Avatar } from "@/components/app/Avatar";
import {
  JoinCreation,
  RolePicker,
  ScheduleShoot,
  StatusLadder,
} from "@/components/create/CrewControls";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Create · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.create;

/**
 * The creation room.
 *
 * A workbench for one thing: the reference at the top where it belongs, the crew with
 * their jobs, the ladder showing how far along it is, and one door out — book the
 * shoot, which is a planning problem and therefore ALIGN's.
 *
 * The role picker only appears once you have joined. Asking somebody what their job
 * is on a shoot they have not agreed to is the wrong order.
 */
export default async function CreationRoom({
  params,
}: PageProps<"/g/[slug]/create/[createId]">) {
  const { slug, createId } = await params;
  const { group, profile } = await requireGroup(slug);
  const { creation, avatars } = await getCreation(createId, profile.id);

  if (!creation || creation.group_id !== group.id) notFound();

  const host = referenceHost(creation.reference_url);
  const onIt = creation.crew.filter((member) => member.status === "in");
  const joined = creation.mine?.status === "in";

  return (
    <div className="room room-creation" style={{ ["--room" as string]: room.accent }}>
      <Link className="thread-back" href={`/g/${slug}/create`}>
        ← the wall
      </Link>

      <header className="creation-head">
        <p className="room-kicker">
          CREATE · <span>{timeAgo(creation.created_at)}</span>
        </p>
        <h1 className="creation-title">{creation.title}</h1>
        {creation.description && <p className="creation-desc">{creation.description}</p>}

        {creation.reference_url && (
          <a
            className="reference-card"
            href={creation.reference_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            <span className="reference-label">THE REFERENCE</span>
            <span className="reference-host">{host}</span>
            <span className="reference-url">{creation.reference_url}</span>
          </a>
        )}

        <p className="creation-author">
          pinned by {creation.author?.display_name ?? "someone"}
        </p>
      </header>

      <section className="creation-block">
        <h2 className="section-label">WHERE IT&apos;S UP TO</h2>
        <StatusLadder createId={creation.id} slug={slug} status={creation.status} />
      </section>

      <section className="creation-block">
        <h2 className="section-label">
          {onIt.length === 0 ? "NOBODY'S ON IT YET" : `${onIt.length} ON IT`}
        </h2>

        {onIt.length > 0 && (
          <ul className="crew-list">
            {onIt.map((member) => (
              <li key={member.profile.id}>
                <Avatar
                  url={avatars.get(member.profile.id) ?? null}
                  name={member.profile.display_name}
                  size={40}
                />
                <div>
                  <p className="crew-list-name">{member.profile.display_name}</p>
                  <p className="crew-list-role">
                    {member.role ? CREATE_ROLE_LABEL[member.role] : "no job yet"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="creation-join">
          <JoinCreation createId={creation.id} slug={slug} joined={joined} />
          {joined && (
            <RolePicker
              createId={creation.id}
              slug={slug}
              role={creation.mine?.role ?? null}
            />
          )}
        </div>
      </section>

      <footer className="creation-foot">
        {creation.planId ? (
          <div className="lock lock-done">
            <p className="lock-line">The shoot&apos;s already booked.</p>
            <Link className="btn btn-room" href={`/g/${slug}/align/${creation.planId}`}>
              Open it in ALIGN ↗
            </Link>
          </div>
        ) : onIt.length > 0 ? (
          <ScheduleShoot
            createId={creation.id}
            slug={slug}
            crewCount={onIt.length}
          />
        ) : (
          <p className="poster-gate">
            Somebody has to be on it before there&apos;s a shoot to book.
          </p>
        )}
      </footer>
    </div>
  );
}
