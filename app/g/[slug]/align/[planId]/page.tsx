import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { getPlan } from "@/lib/data/align";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { Avatar } from "@/components/app/Avatar";
import { BlockerOptions, type ClientOption } from "@/components/align/Blocker";
import { AttendanceControl } from "@/components/align/Attendance";
import { CaptureToVault, LockPlan, UnlockPlan } from "@/components/align/LockPlan";
import { fullDate, shortDate } from "@/lib/format";
import type { OptionType } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Plan · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.align;

const PLACEHOLDER: Record<OptionType, string> = {
  date: "",
  location: "somewhere",
  budget: "a number, roughly",
};

/**
 * The plan room.
 *
 * Structured as a ledger of open questions rather than a form of fields. Each blocker
 * is numbered, asked in plain language, and either struck through with its answer or
 * open with a ballot under it. Reading top to bottom tells you what is left — which
 * is the only thing anybody comes in here to find out.
 *
 * Resolved and unresolved look genuinely different, not just differently coloured: a
 * settled question collapses to one line of answer, an open one expands into the
 * options and the faces behind them. The room visibly shrinks as the group agrees.
 */
export default async function PlanRoom({ params }: PageProps<"/g/[slug]/align/[planId]">) {
  const { slug, planId } = await params;
  const { group, profile } = await requireGroup(slug);
  const { plan, avatars } = await getPlan(planId, profile.id);

  if (!plan || plan.group_id !== group.id) notFound();

  const isLocked = plan.status === "locked" || plan.status === "done";

  const toClient = (
    options: (typeof plan.blockers)[number]["options"],
  ): ClientOption[] =>
    options.map((option) => ({
      id: option.id,
      value: option.value,
      votes: option.voters.length,
      mine: option.mine,
      createdByMe: option.created_by === profile.id,
      voters: option.voters.map((voter) => ({
        id: voter.id,
        name: voter.display_name,
        url: avatars.get(voter.id) ?? null,
      })),
    }));

  // What Lock Plan will freeze: the option currently ahead for each question.
  const dateBlocker = plan.blockers.find((b) => b.key === "date");
  const placeBlocker = plan.blockers.find((b) => b.key === "location");
  const budgetBlocker = plan.blockers.find((b) => b.key === "budget");

  const winningDate = plan.final_date ?? dateBlocker?.leader?.value ?? null;
  const winningPlace = plan.final_location ?? placeBlocker?.leader?.value ?? null;
  const winningBudget = plan.final_budget ?? budgetBlocker?.leader?.value ?? null;

  const missing: string[] = [];
  if (!winningDate) missing.push("date");
  if (!winningPlace) missing.push("place");

  const going = plan.attendance.filter((entry) => entry.status === "in");
  const maybes = plan.attendance.filter((entry) => entry.status === "maybe");
  const outs = plan.attendance.filter((entry) => entry.status === "out");

  return (
    <div className="room room-plan" style={{ ["--room" as string]: room.accent }}>
      <Link className="thread-back" href={`/g/${slug}/align`}>
        ← all plans
      </Link>

      <header className="plan-head">
        <p className="room-kicker">
          ALIGN · <span>{plan.status}</span>
        </p>
        <h1 className="plan-title">{plan.title}</h1>
        {plan.description && <p className="plan-desc">{plan.description}</p>}

        {plan.origin && (
          <p className="plan-origin">
            came from{" "}
            <Link
              href={
                plan.origin.room === "one-day"
                  ? `/g/${slug}/one-day/${plan.origin.id}`
                  : `/g/${slug}/create/${plan.origin.id}`
              }
            >
              {plan.origin.title}
            </Link>{" "}
            in {plan.origin.room === "one-day" ? "ONE DAY" : "CREATE"}
          </p>
        )}

        {isLocked && plan.final_date && (
          <p className="plan-locked-banner">
            <span>LOCKED</span>
            {fullDate(plan.final_date)} · {plan.final_location}
            {plan.final_budget ? ` · ${plan.final_budget}` : ""}
          </p>
        )}
      </header>

      {/* ---------------------------------------------------------- the ledger */}
      <section className="blockers">
        {/*
          `plan.unresolved`, not `missing`. They answer different questions and
          conflating them made this header claim "nothing's stopping this" over a plan
          with three open blockers: `missing` only asks whether there is a *candidate*
          to lock (a leading option exists), while `unresolved` is what the group has
          actually settled. The list page reads `unresolved` too, so this keeps the
          room's central question consistent between the two views.
        */}
        <h2 className="section-label">
          {plan.unresolved.length === 0
            ? "NOTHING'S STOPPING THIS"
            : `WHAT'S STOPPING THIS · ${plan.unresolved.length}`}
        </h2>

        <ol className="blocker-list">
          {plan.blockers
            .filter((blocker) => blocker.key !== "who")
            .map((blocker, index) => {
              const optional = blocker.key === "budget";
              const settled = blocker.resolved;

              return (
                <li
                  key={blocker.key}
                  className="blocker"
                  data-resolved={settled}
                  data-optional={optional}
                >
                  <div className="blocker-head">
                    <span className="blocker-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="blocker-question">{blocker.question}</h3>
                    {optional && !settled && (
                      <span className="blocker-optional">optional</span>
                    )}
                    {settled && (
                      <p className="blocker-answer">
                        {blocker.key === "date" && blocker.answer
                          ? shortDate(blocker.answer)
                          : blocker.answer}
                      </p>
                    )}
                  </div>

                  {!settled && (
                    <BlockerOptions
                      planId={plan.id}
                      slug={slug}
                      type={blocker.key as OptionType}
                      options={toClient(blocker.options)}
                      placeholder={PLACEHOLDER[blocker.key as OptionType]}
                      locked={isLocked}
                    />
                  )}
                </li>
              );
            })}

          {/* ------------------------------------------------ who, which is not a ballot */}
          <li className="blocker blocker-who" data-resolved={!plan.unresolved.includes("who")}>
            <div className="blocker-head">
              <span className="blocker-index" aria-hidden="true">
                04
              </span>
              <h3 className="blocker-question">Who&apos;s actually coming?</h3>
              <p className="blocker-answer">
                {plan.inCount} of {plan.memberCount} in
              </p>
            </div>

            <AttendanceControl
              planId={plan.id}
              slug={slug}
              current={plan.myAttendance}
            />

            <div className="roster">
              {[
                { label: "IN", people: going },
                { label: "MAYBE", people: maybes },
                { label: "OUT", people: outs },
              ]
                .filter((column) => column.people.length > 0)
                .map((column) => (
                  <div key={column.label} className="roster-column">
                    <p className="roster-label">
                      {column.label} · {column.people.length}
                    </p>
                    <ul>
                      {column.people.map(({ profile: person }) => (
                        <li key={person.id}>
                          <Avatar
                            url={avatars.get(person.id) ?? null}
                            name={person.display_name}
                            size={26}
                          />
                          <span>{person.display_name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </li>
        </ol>
      </section>

      {/* ---------------------------------------------------------- the decision */}
      <footer className="plan-foot">
        {isLocked ? (
          <div className="lock lock-done">
            <p className="lock-line">
              {plan.status === "done"
                ? "This one's already in the Vault."
                : "Locked. Everybody knows where to be."}
            </p>
            <div className="inline-form-actions">
              {plan.status === "locked" && (
                <>
                  <CaptureToVault planId={plan.id} slug={slug} />
                  <UnlockPlan planId={plan.id} slug={slug} />
                </>
              )}
              {plan.status === "done" && plan.capsuleId && (
                <Link className="btn btn-room" href={`/g/${slug}/vault/${plan.capsuleId}`}>
                  Open the memory ↗
                </Link>
              )}
            </div>
          </div>
        ) : (
          <LockPlan
            planId={plan.id}
            slug={slug}
            date={winningDate}
            location={winningPlace}
            budget={winningBudget}
            missing={missing}
          />
        )}
      </footer>
    </div>
  );
}
