"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addOption, removeOption, toggleVote } from "@/lib/actions/rooms";
import { AvatarStack } from "@/components/app/Avatar";
import { Close, Plus } from "@/components/app/Icons";
import { toast } from "@/components/app/Toast";
import type { Person } from "@/components/app/People";
import type { OptionType } from "@/lib/supabase/database.types";

export type ClientOption = {
  id: string;
  value: string;
  label: string;
  voters: Person[];
  createdByMe: boolean;
};

/**
 * One open question and its ballot.
 *
 * Each option is a line you can press: the answer in display type, then one dot per
 * person in the group — filled for everyone who is up for it — then their faces.
 * `● ● ● ● ● ● ○ ○ ○  6/9` is the whole reading; you see the group's answer as a
 * shape before you read a number. Votes are optimistic: the dot fills the instant
 * you press and rolls back only if the server says no.
 */
export function Ballot({
  planId,
  slug,
  type,
  options,
  me,
  total,
  locked,
  placeholder,
}: {
  planId: string;
  slug: string;
  type: OptionType;
  options: ClientOption[];
  me: Person;
  total: number;
  locked: boolean;
  placeholder: string;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [view, flip] = useOptimistic(options, (current, optionId: string) =>
    current.map((option) => {
      if (option.id !== optionId) return option;
      const mine = option.voters.some((v) => v.id === me.id);
      return {
        ...option,
        voters: mine ? option.voters.filter((v) => v.id !== me.id) : [...option.voters, me],
      };
    }),
  );

  const top = Math.max(0, ...view.map((o) => o.voters.length));

  const vote = (optionId: string) =>
    startTransition(async () => {
      flip(optionId);
      const result = await toggleVote(optionId, planId, slug);
      if (result.error) toast(result.error, "error");
    });

  const submit = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft("");
    setError(null);
    startTransition(async () => {
      const result = await addOption(planId, slug, type, value);
      if (result.error) {
        setError(result.error);
        setDraft(value);
      }
    });
  };

  return (
    <div className="ballot">
      {view.length > 0 && (
        <ul className="ballot-list">
          {view.map((option) => {
            const mine = option.voters.some((v) => v.id === me.id);
            const leading = option.voters.length === top && top > 0;
            return (
              <li key={option.id} className="ballot-row" data-leading={leading} data-mine={mine}>
                <button
                  className="ballot-option"
                  type="button"
                  aria-pressed={mine}
                  disabled={locked}
                  onClick={() => vote(option.id)}
                >
                  <span className="ballot-value display">{option.label}</span>
                  <span className="ballot-dots" aria-hidden="true">
                    {Array.from({ length: total }, (_, i) => (
                      <i key={i} data-on={i < option.voters.length} style={{ ["--d" as string]: i }} />
                    ))}
                  </span>
                  <span className="ballot-tally">
                    <b>{option.voters.length}</b>/{total}
                    <span className="sr-only"> people, {mine ? "including you" : "not you"}</span>
                  </span>
                  <span className="ballot-faces">
                    {option.voters.length > 0 && <AvatarStack people={option.voters} max={5} size={22} />}
                  </span>
                  {leading && <span className="ballot-lead">leading</span>}
                </button>

                {option.createdByMe && !locked && option.voters.length <= 1 && (
                  <button
                    className="ballot-remove"
                    type="button"
                    aria-label={`Take back ${option.label}`}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await removeOption(option.id, planId, slug);
                        if (result.error) toast(result.error, "error");
                      })
                    }
                  >
                    <Close width={14} height={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!locked && (
        <form
          className="ballot-add"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="sr-only" htmlFor={`add-${type}`}>
            Suggest {type === "date" ? "a date" : type === "location" ? "a place" : "a budget"}
          </label>
          <input
            id={`add-${type}`}
            className="input"
            type={type === "date" ? "date" : "text"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            maxLength={200}
          />
          <button className="btn btn-sm" type="submit" disabled={pending || !draft.trim()}>
            <Plus width={14} height={14} /> Suggest
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
