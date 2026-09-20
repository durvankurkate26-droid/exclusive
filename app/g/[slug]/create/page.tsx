import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { listCreations } from "@/lib/data/create";
import {
  CREATE_ROLE_LABEL,
  CREATE_STATUS_LABEL,
  referenceHost,
} from "@/lib/constants/create";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { RoomHeader, EmptyState } from "@/components/app/RoomHeader";
import { Avatar } from "@/components/app/Avatar";
import { AddCreation } from "@/components/create/AddCreation";
import { JoinCreation } from "@/components/create/CrewControls";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Create · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.create;

/**
 * CREATE — the studio wall.
 *
 * Things pinned up, not tickets in a queue. The difference is legible in three
 * decisions: each card carries its reference as a visible source line (this started
 * as a link somebody sent, and the wall should say so), the crew are faces with jobs
 * written under them rather than assignee avatars, and the status is one small line
 * of plain speech — "shot it", "editing" — instead of a column position.
 *
 * Nothing here has a due date, because none of these have one until somebody takes
 * them to ALIGN.
 */
export default async function CreatePage({ params }: PageProps<"/g/[slug]/create">) {
  const { slug } = await params;
  const { group, profile } = await requireGroup(slug);
  const { live, shipped, avatars } = await listCreations(group.id, profile.id);

  return (
    <div className="room room-create" style={{ ["--room" as string]: room.accent }}>
      <RoomHeader room={room} count={live.length ? `${live.length} IN PROGRESS` : undefined}>
        <AddCreation groupId={group.id} slug={slug} />
      </RoomHeader>

      {live.length === 0 && shipped.length === 0 ? (
        <EmptyState line={room.empty.line} hint={room.empty.hint}>
          <AddCreation groupId={group.id} slug={slug} />
        </EmptyState>
      ) : (
        <>
          {live.length > 0 && (
            <div className="studio-wall">
              {live.map((creation, index) => {
                const host = referenceHost(creation.reference_url);
                const onIt = creation.crew.filter((member) => member.status === "in");

                return (
                  <article
                    key={creation.id}
                    className="pinned"
                    data-tilt={index % 4}
                  >
                    {/* The tape is what makes it pinned paper rather than a card. */}
                    <span className="pinned-tape" aria-hidden="true" />

                    <p className="pinned-source">
                      {host ? (
                        <a
                          href={creation.reference_url ?? "#"}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          ref · {host} ↗
                        </a>
                      ) : (
                        <span>no reference</span>
                      )}
                    </p>

                    <Link href={`/g/${slug}/create/${creation.id}`} className="pinned-link">
                      <h3 className="pinned-title">{creation.title}</h3>
                    </Link>

                    {creation.description && (
                      <p className="pinned-desc">{creation.description}</p>
                    )}

                    <p className="pinned-status">{CREATE_STATUS_LABEL[creation.status]}</p>

                    {onIt.length > 0 && (
                      <ul className="crew-strip">
                        {onIt.slice(0, 5).map((member) => (
                          <li key={member.profile.id}>
                            <Avatar
                              url={avatars.get(member.profile.id) ?? null}
                              name={member.profile.display_name}
                              size={28}
                            />
                            <span className="crew-name">
                              {member.profile.display_name.split(" ")[0]}
                            </span>
                            <span className="crew-role">
                              {member.role ? CREATE_ROLE_LABEL[member.role] : "in"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="pinned-foot">
                      <JoinCreation
                        createId={creation.id}
                        slug={slug}
                        joined={creation.mine?.status === "in"}
                      />
                      <span className="pinned-time">{timeAgo(creation.updated_at)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {shipped.length > 0 && (
            <section className="wall-section">
              <h2 className="section-label">WE ACTUALLY MADE THESE</h2>
              <ul className="promoted-list">
                {shipped.map((creation) => (
                  <li key={creation.id}>
                    <Link href={`/g/${slug}/create/${creation.id}`}>
                      <span className="promoted-title">{creation.title}</span>
                      <span className="promoted-state">
                        {CREATE_STATUS_LABEL[creation.status]}
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
