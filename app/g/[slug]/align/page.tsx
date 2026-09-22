import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup, roomContext } from "@/lib/data/session";
import { listPlans, type PlanSummary } from "@/lib/data/align";
import { AvatarStack } from "@/components/app/Avatar";
import { RoomGlyph } from "@/components/app/Icons";
import { toPeople } from "@/components/app/People";
import { CreatePlan } from "@/components/align/CreatePlan";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { tilt } from "@/lib/art";
import { dayOfMonth, daysUntil, shortDate, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Align · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.align;

/**
 * ALIGN — every plan ranked by how close it is to happening.
 *
 * Each open plan shows its three blockers as marks on a line: answered ones sit
 * straight, open ones hang crooked. You can read the whole room from across it —
 * the straighter the row, the closer the plan. Locked plans graduate into a
 * separate, calm "happening" list with the facts that matter: when, where, who.
 */
export default async function AlignPage({ params, searchParams }: PageProps<"/g/[slug]/align">) {
  const { slug } = await params;
  const { new: wantsNew } = await searchParams;
  const { groupId } = await roomContext(slug);
  const [{ group }, { open, locked, done, memberCount, avatars }] = await Promise.all([
    requireGroup(slug),
    listPlans(groupId),
  ]);

  const nothing = open.length + locked.length + done.length === 0;

  const marks = (plan: PlanSummary) => [
    { key: "date", label: plan.final_date ? shortDate(plan.final_date) : "WHEN", open: plan.unresolved.includes("date") },
    { key: "place", label: plan.final_location ?? "WHERE", open: plan.unresolved.includes("place") },
    { key: "who", label: `${plan.inCount}/${memberCount} IN`, open: plan.unresolved.includes("who") },
  ];

  return (
    <div className="align-room">
      <header className="room-intro">
        <div>
          <h1 className="display align-title">
            What&apos;s stopping <span>this?</span>
          </h1>
        </div>
        <CreatePlan groupId={group.id} slug={slug} defaultOpen={wantsNew === "1"} />
      </header>

      {nothing && (
        <div className="empty">
          <p className="empty-line">
            Nothing to figure out.
            <span>For once.</span>
          </p>
          <p className="empty-hint">{room.empty.hint} Start one, or promote a ONE DAY idea that has enough hands.</p>
        </div>
      )}

      {locked.length > 0 && (
        <section className="happening-list" aria-labelledby="happening-h">
          <h2 className="section-title" id="happening-h">It&apos;s happening</h2>
          <ul>
            {locked.map((plan) => {
              const days = plan.final_date ? daysUntil(plan.final_date) : null;
              return (
                <li key={plan.id}>
                  {/* A locked plan is a ticket: straight, stamped, nothing left to argue about. */}
                  <Link href={`/g/${slug}/align/${plan.id}`} className="plan-ticket">
                    <span className="plan-ticket-date" aria-hidden={!plan.final_date}>
                      {plan.final_date ? (
                        <>
                          <b className="display">{dayOfMonth(plan.final_date)}</b>
                          <span>{shortDate(plan.final_date).split(" ")[0]} {shortDate(plan.final_date).split(" ")[2]}</span>
                        </>
                      ) : (
                        <b className="display">?</b>
                      )}
                    </span>
                    <span className="plan-ticket-body">
                      <span className="display plan-ticket-title">{plan.title}</span>
                      <span className="plan-ticket-where">
                        {plan.final_location ?? "Place TBD"}
                        {days !== null && days >= 0 && (
                          <em>{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}</em>
                        )}
                      </span>
                      {plan.from && (
                        <span className="plan-ticket-from">
                          Started as {plan.from.room === "one-day" ? "a someday" : "a make"}: {plan.from.title}
                        </span>
                      )}
                    </span>
                    <span className="plan-ticket-stub">
                      {plan.people.length > 0 && <AvatarStack people={toPeople(plan.people, avatars)} max={5} size={26} />}
                      <span className="display">{plan.inCount}/{memberCount} going</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {open.length === 0 && !nothing && (
        <p className="align-calm">
          Nothing&apos;s stuck right now. Start a plan, or take a{" "}
          <Link href={`/g/${slug}/one-day`}>someday with enough hands</Link> and make it real.
        </p>
      )}

      {open.length > 0 && (
        <section className="figuring" aria-labelledby="figuring-h">
          <h2 className="section-title" id="figuring-h">
            Still figuring out <span className="meta">closest first</span>
          </h2>
          <ol className="figuring-list">
            {open.map((plan) => (
              <li key={plan.id}>
                <Link href={`/g/${slug}/align/${plan.id}`} className="figuring-row">
                  <span className="figuring-name display">{plan.title}</span>
                  <span className="figuring-marks" aria-label={`${plan.unresolved.length} still open`}>
                    {marks(plan).map((m) => (
                      <span
                        key={m.key}
                        data-open={m.open}
                        style={{ ["--t" as string]: m.open ? `${tilt(plan.id + m.key, 3)}deg` : "0deg" }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </span>
                  <span className="figuring-foot">
                    {plan.people.length > 0 && <AvatarStack people={toPeople(plan.people, avatars)} max={5} size={22} />}
                    <span className="meta">
                      {plan.unresolved.length === 0 ? "ready to lock" : `${plan.unresolved.length} open`} · {timeAgo(plan.updated_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {done.length > 0 && (
        <section className="align-done" aria-labelledby="done-h">
          <h2 className="section-title" id="done-h">Done &amp; dusted</h2>
          <ul>
            {done.map((plan) => (
              <li key={plan.id} className="done-row">
                <Link href={`/g/${slug}/align/${plan.id}`} className="done-plan">
                  <span className="done-title">{plan.title}</span>
                  <span className="meta">{plan.final_date ? shortDate(plan.final_date) : plan.status}</span>
                </Link>
                {plan.memoryId ? (
                  <Link className="done-memory" href={`/g/${slug}/vault/${plan.memoryId}`}>
                    <RoomGlyph room="vault" width={14} height={14} aria-hidden="true" /> In the vault
                  </Link>
                ) : plan.status === "done" ? (
                  <Link className="done-memory" href={`/g/${slug}/vault?new=1`}>
                    <RoomGlyph room="vault" width={14} height={14} aria-hidden="true" /> Turn it into a memory
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
