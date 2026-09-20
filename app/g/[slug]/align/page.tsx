import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { listPlans, type PlanSummary } from "@/lib/data/align";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { RoomHeader, EmptyState } from "@/components/app/RoomHeader";
import { AvatarStack } from "@/components/app/Avatar";
import { CreatePlan } from "@/components/align/CreatePlan";
import { shortDate, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Align · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.align;

/**
 * ALIGN — the list of things not happening yet, and why.
 *
 * Every row answers one question: what is stopping this? The blockers are the loudest
 * thing on the card — larger than the date, larger than the people — because a plan
 * with no date is not an event yet, it is an argument, and the argument is what needs
 * attention.
 *
 * Ordered by how close each plan is to being unblocked rather than by date. A
 * corporate calendar sorts by when things happen; this sorts by what needs a human.
 */
export default async function AlignPage({ params }: PageProps<"/g/[slug]/align">) {
  const { slug } = await params;
  const { group } = await requireGroup(slug);
  const { open, locked, done, memberCount, avatars } = await listPlans(group.id);

  const faces = (people: PlanSummary["people"]) =>
    people.map((person) => ({
      id: person.id,
      name: person.display_name,
      url: avatars.get(person.id) ?? null,
    }));

  const nothing = open.length === 0 && locked.length === 0 && done.length === 0;

  return (
    <div className="room room-align" style={{ ["--room" as string]: room.accent }}>
      <RoomHeader
        room={room}
        count={open.length ? `${open.length} UNRESOLVED` : undefined}
      >
        <CreatePlan groupId={group.id} slug={slug} />
      </RoomHeader>

      {nothing ? (
        <EmptyState line={room.empty.line} hint={room.empty.hint}>
          <CreatePlan groupId={group.id} slug={slug} />
        </EmptyState>
      ) : (
        <div className="align-list">
          {open.length > 0 && (
            <section>
              <h2 className="section-label">STILL FIGURING IT OUT</h2>
              <ul className="plan-rows">
                {open.map((plan) => (
                  <li key={plan.id}>
                    <Link href={`/g/${slug}/align/${plan.id}`} className="plan-row">
                      <div className="plan-row-main">
                        <h3 className="plan-row-title">{plan.title}</h3>
                        {plan.unresolved.length > 0 ? (
                          <p className="plan-blocking">
                            <span className="plan-blocking-label">STILL NO</span>
                            {plan.unresolved.map((item) => (
                              <span key={item} className="plan-chip">
                                {item}
                              </span>
                            ))}
                          </p>
                        ) : (
                          <p className="plan-blocking is-clear">
                            <span className="plan-blocking-label">NOTHING&apos;S STOPPING IT</span>
                            <span className="plan-chip is-clear">ready to lock</span>
                          </p>
                        )}
                      </div>

                      <div className="plan-row-side">
                        <AvatarStack people={faces(plan.people)} max={5} size={26} />
                        <span className="plan-row-meta">
                          {plan.inCount}/{memberCount} in · {timeAgo(plan.updated_at)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {locked.length > 0 && (
            <section>
              <h2 className="section-label">IT&apos;S HAPPENING</h2>
              <ul className="plan-rows is-locked">
                {locked.map((plan) => (
                  <li key={plan.id}>
                    <Link href={`/g/${slug}/align/${plan.id}`} className="plan-row">
                      <div className="plan-row-main">
                        <h3 className="plan-row-title">{plan.title}</h3>
                        <p className="plan-settled">
                          {plan.final_date && <strong>{shortDate(plan.final_date)}</strong>}
                          {plan.final_location && <span>{plan.final_location}</span>}
                          {plan.final_budget && <span>{plan.final_budget}</span>}
                        </p>
                      </div>
                      <div className="plan-row-side">
                        <AvatarStack people={faces(plan.people)} max={5} size={26} />
                        <span className="plan-row-meta">{plan.inCount} coming</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="section-label">BEEN AND GONE</h2>
              <ul className="promoted-list">
                {done.map((plan) => (
                  <li key={plan.id}>
                    <Link href={`/g/${slug}/align/${plan.id}`}>
                      <span className="promoted-title">{plan.title}</span>
                      <span className="promoted-state">
                        {plan.status === "cancelled"
                          ? "cancelled"
                          : plan.final_date
                            ? shortDate(plan.final_date)
                            : "done"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
