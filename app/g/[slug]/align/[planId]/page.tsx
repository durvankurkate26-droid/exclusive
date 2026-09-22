import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup, getGroupMembers } from "@/lib/data/session";
import { getPlan, type Blocker } from "@/lib/data/align";
import { resolveAvatars } from "@/lib/data/media";
import { AvatarStack } from "@/components/app/Avatar";
import { ArrowLeft, Check } from "@/components/app/Icons";
import { toPeople, type Person } from "@/components/app/People";
import { Ballot, type ClientOption } from "@/components/align/Ballot";
import { Attendance } from "@/components/align/Attendance";
import { CaptureToVault, LockBar, UnlockPlan } from "@/components/align/LockPlan";
import { LiveRefresh } from "@/lib/realtime";
import { tilt } from "@/lib/art";
import { fullDate, shortDate } from "@/lib/format";
import type { OptionType } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Plan · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const PLACEHOLDER: Record<OptionType, string> = {
  date: "",
  location: "Bandra, Rohan's terrace, anywhere…",
  budget: "₹1,500 each, roughly",
};

const ASK: Record<string, string> = {
  date: "When?",
  location: "Where?",
  budget: "What's it costing?",
  who: "Who's actually coming?",
};

type State = "settled" | "agreed" | "open";

const dateLabel = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? shortDate(value) : value);

/**
 * The plan room — built around one question: what is stopping this from happening?
 *
 * Every blocker is in one of three states. *Settled* (locked onto the plan),
 * *agreed* (one option has a clear majority — the group has effectively answered),
 * or *open*. Open blockers are the page: the worst one takes the big slot and sits
 * visibly crooked; the rest queue behind it, also slightly off. Agreed and settled
 * blockers collapse into a straight, quiet rail at the top. As people vote, things
 * migrate from crooked to straight — the page literally becomes more aligned — and
 * locking straightens whatever is left in one motion.
 */
export default async function PlanRoom({ params }: PageProps<"/g/[slug]/align/[planId]">) {
  const { slug, planId } = await params;
  const { group, profile } = await requireGroup(slug);
  const [{ plan, avatars }, members] = await Promise.all([
    getPlan(planId, profile.id),
    getGroupMembers(group.id),
  ]);

  if (!plan || plan.group_id !== group.id) notFound();

  const memberAvatars = await resolveAvatars(members.map((m) => m.profile));
  const av = new Map([...memberAvatars, ...avatars]);
  const everyone = toPeople(members.map((m) => m.profile), av);
  const me: Person = { id: profile.id, name: profile.display_name, url: av.get(profile.id) ?? null };
  const total = plan.memberCount;
  const majority = Math.max(2, Math.ceil(total / 2));
  const isLocked = plan.status === "locked" || plan.status === "done";

  const stateOf = (b: Blocker): State => {
    if (b.key === "who") return b.resolved ? "agreed" : "open";
    if (b.resolved) return "settled";
    const [first, second] = b.options;
    if (first && first.voters.length >= majority && first.voters.length > (second?.voters.length ?? 0)) return "agreed";
    return "open";
  };

  // Severity: date and place block locking outright; who's coming is next; money is optional.
  const weight: Record<string, number> = { date: 0, location: 1, who: 2, budget: 3 };
  const blockers = plan.blockers
    .filter((b) => b.key !== "budget" || b.options.length > 0 || b.resolved)
    .map((b) => ({ ...b, state: stateOf(b) }))
    .sort((a, b) => weight[a.key] - weight[b.key]);

  const open = blockers.filter((b) => b.state === "open");
  const aligned = blockers.filter((b) => b.state !== "open");
  const budgetUnused = !plan.blockers.find((b) => b.key === "budget")?.options.length && !plan.final_budget;

  const toClient = (b: Blocker): ClientOption[] =>
    b.options.map((o) => ({
      id: o.id,
      value: o.value,
      label: b.key === "date" ? dateLabel(o.value) : o.value,
      voters: toPeople(o.voters, av),
      createdByMe: o.created_by === profile.id,
    }));

  const roster = plan.attendance.map((a) => ({
    person: { id: a.profile.id, name: a.profile.display_name, url: av.get(a.profile.id) ?? null },
    status: a.status,
  }));

  const leader = (key: string) => plan.blockers.find((b) => b.key === key)?.leader?.value ?? null;
  const winDate = plan.final_date ?? leader("date");
  const winPlace = plan.final_location ?? leader("location");
  const winBudget = plan.final_budget ?? leader("budget");
  const missing = [...(!winDate ? ["date"] : []), ...(!winPlace ? ["place"] : [])];

  const answerOf = (b: (typeof blockers)[number]) =>
    b.key === "who"
      ? `${plan.inCount}/${total} in`
      : b.answer
        ? b.key === "date" ? shortDate(b.answer) : b.answer
        : b.leader ? (b.key === "date" ? dateLabel(b.leader.value) : b.leader.value) : "";

  const renderBlocker = (b: (typeof blockers)[number], focus: boolean, index: number) => {
    const t = tilt(plan.id + b.key, focus ? 1.1 : 1.6);
    return (
      <section
        key={b.key}
        className="blocker"
        data-focus={focus}
        data-offset
        aria-labelledby={`q-${b.key}`}
        style={{ transform: `rotate(${t}deg) translateX(${focus ? 0 : (index % 2 ? 10 : -6)}px)` }}
      >
        <header className="blocker-head">
          <h2 className="display blocker-q" id={`q-${b.key}`}>{ASK[b.key]}</h2>
          <p className="blocker-why">
            {b.key === "who"
              ? `Needs ${majority} people in to count as a plan.`
              : b.options.length === 0
                ? "Nobody has suggested anything. Be the one."
                : `Needs ${majority} votes on one option.`}
          </p>
        </header>

        {b.key === "who" ? (
          <Attendance planId={plan.id} slug={slug} me={me} roster={roster} everyone={everyone} locked={false} />
        ) : (
          <Ballot
            planId={plan.id}
            slug={slug}
            type={b.key as OptionType}
            options={toClient(b)}
            me={me}
            total={total}
            locked={isLocked}
            placeholder={PLACEHOLDER[b.key as OptionType]}
          />
        )}
      </section>
    );
  };

  return (
    <div className="plan" data-state={plan.status}>
      <LiveRefresh
        id={`plan-${plan.id}`}
        tables={[
          { table: "plan_votes" },
          { table: "plan_members", filter: `plan_id=eq.${plan.id}` },
          { table: "plan_options", filter: `plan_id=eq.${plan.id}` },
          { table: "plans", filter: `id=eq.${plan.id}` },
        ]}
      />

      <Link className="back" href={`/g/${slug}/align`}>
        <ArrowLeft /> All plans
      </Link>

      {isLocked ? (
        /* ------------------------------------------------------------ it's happening */
        <section className="happening" aria-label="Locked plan">
          <p className="happening-stamp display">{plan.status === "done" ? "IT HAPPENED." : "IT'S HAPPENING."}</p>
          <h1 className="display happening-title">{plan.title}</h1>
          <dl className="happening-facts">
            <div>
              <dt className="meta">WHEN</dt>
              <dd className="display">{plan.final_date ? shortDate(plan.final_date) : "—"}</dd>
              {plan.final_date && <dd className="happening-sub">{fullDate(plan.final_date)}</dd>}
            </div>
            <div>
              <dt className="meta">WHERE</dt>
              <dd className="display">{plan.final_location ?? "—"}</dd>
            </div>
            {plan.final_budget && (
              <div>
                <dt className="meta">COST</dt>
                <dd className="display">{plan.final_budget}</dd>
              </div>
            )}
            <div>
              <dt className="meta">WHO</dt>
              <dd className="happening-who">
                <AvatarStack people={roster.filter((r) => r.status === "in").map((r) => r.person)} max={9} size={32} />
                <span className="display">{plan.inCount}/{total}</span>
              </dd>
            </div>
          </dl>

          <div className="happening-actions">
            {plan.status === "locked" && (
              <>
                <CaptureToVault planId={plan.id} slug={slug} />
                <UnlockPlan planId={plan.id} slug={slug} />
              </>
            )}
            {plan.status === "done" && plan.capsuleId && (
              <Link className="btn btn-lit" href={`/g/${slug}/vault/${plan.capsuleId}`}>
                Open the memory
              </Link>
            )}
          </div>

          {plan.status === "locked" && (
            <div className="happening-rsvp">
              <h2 className="section-title">Still coming?</h2>
              <Attendance planId={plan.id} slug={slug} me={me} roster={roster} everyone={everyone} locked={false} />
            </div>
          )}
        </section>
      ) : (
        <>
          {/* ------------------------------------------------------------ the question */}
          <header className="plan-head">
            <h1 className="display plan-title">{plan.title}</h1>
            <p className="plan-verdict display" data-clear={open.length === 0}>
              {open.length === 0
                ? "Nothing's stopping this."
                : open.length === 1
                  ? "One thing is stopping this."
                  : `${["", "One", "Two", "Three", "Four"][open.length]} things are stopping this.`}
            </p>
            {(plan.description || plan.origin) && (
              <p className="lede">
                {plan.description}
                {plan.origin && (
                  <>
                    {plan.description ? " " : ""}Came from{" "}
                    <Link href={`/g/${slug}/${plan.origin.room}/${plan.origin.id}`}>{plan.origin.title}</Link> in{" "}
                    {plan.origin.room === "one-day" ? "ONE DAY" : "CREATE"}.
                  </>
                )}
              </p>
            )}

            {aligned.length > 0 && (
              <ul className="plan-rail" aria-label="Already agreed">
                {aligned.map((b) => (
                  <li key={b.key} data-state={b.state}>
                    <Check width={14} height={14} />
                    <span className="meta">{b.key === "location" ? "PLACE" : b.key.toUpperCase()}</span>
                    <span className="display">{answerOf(b)}</span>
                  </li>
                ))}
              </ul>
            )}
          </header>

          {/* ------------------------------------------------------------ the board */}
          <div className="plan-board">
            {open.length > 0 && renderBlocker(open[0], true, 0)}
            {open.length > 1 && (
              <div className="plan-queue">{open.slice(1).map((b, i) => renderBlocker(b, false, i + 1))}</div>
            )}

            {aligned.length > 0 && (
              <div className="plan-settled">
                <h2 className="section-title">Sorted <span className="meta">change your mind anytime</span></h2>
                {aligned.map((b) => (
                  <details key={b.key} className="settled">
                    <summary>
                      <span className="display">{ASK[b.key]}</span>
                      <span className="settled-answer">{answerOf(b)}</span>
                    </summary>
                    <div className="settled-body">
                      {b.key === "who" ? (
                        <Attendance planId={plan.id} slug={slug} me={me} roster={roster} everyone={everyone} locked={false} />
                      ) : (
                        <Ballot
                          planId={plan.id}
                          slug={slug}
                          type={b.key as OptionType}
                          options={toClient(b)}
                          me={me}
                          total={total}
                          locked={false}
                          placeholder={PLACEHOLDER[b.key as OptionType]}
                        />
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {budgetUnused && (
              <details className="settled settled-optional">
                <summary>
                  <span className="display">Money?</span>
                  <span className="settled-answer">optional — only if it matters</span>
                </summary>
                <div className="settled-body">
                  <Ballot planId={plan.id} slug={slug} type="budget" options={[]} me={me} total={total} locked={false} placeholder={PLACEHOLDER.budget} />
                </div>
              </details>
            )}
          </div>

          <LockBar
            planId={plan.id}
            slug={slug}
            date={winDate ? { iso: winDate, label: dateLabel(winDate) } : null}
            place={winPlace}
            budget={winBudget}
            going={plan.inCount}
            missing={missing}
          />
        </>
      )}
    </div>
  );
}
