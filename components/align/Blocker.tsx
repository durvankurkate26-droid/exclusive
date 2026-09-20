"use client";

import { useState, useTransition } from "react";
import { addOption, removeOption, toggleVote } from "@/lib/actions/rooms";
import { Avatar } from "@/components/app/Avatar";
import { shortDate } from "@/lib/format";
import type { OptionType } from "@/lib/supabase/database.types";

export type ClientOption = {
  id: string;
  value: string;
  votes: number;
  mine: boolean;
  createdByMe: boolean;
  voters: Array<{ id: string; name: string; url: string | null }>;
};

/**
 * One open question, and the ballot under it.
 *
 * This is the centre of ALIGN, so it is worth saying what it is *not*: it is not a
 * poll widget and it is not a calendar. Each option is a full-width row whose
 * background fills in proportion to its support, so the leader is legible as a shape
 * before you read a single number — the group's answer is something you see, not
 * something you tally.
 *
 * Voting is a toggle and votes are not secret. Nine people deciding where to eat do
 * not need a secret ballot; they need to know who else is up for it.
 */
export function BlockerOptions({
  planId,
  slug,
  type,
  options,
  placeholder,
  locked,
}: {
  planId: string;
  slug: string;
  type: OptionType;
  options: ClientOption[];
  placeholder: string;
  locked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const top = Math.max(1, ...options.map((option) => option.votes));

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
      {options.length > 0 && (
        <ul className="ballot-list">
          {options.map((option) => (
            <li key={option.id}>
              <button
                className="ballot-option"
                type="button"
                data-mine={option.mine}
                data-leading={option.votes === top && option.votes > 0}
                disabled={pending || locked}
                aria-pressed={option.mine}
                onClick={() =>
                  startTransition(async () => {
                    await toggleVote(option.id, planId, slug);
                  })
                }
              >
                {/* The bar is the reading. The number is the footnote. */}
                <span
                  className="ballot-fill"
                  aria-hidden="true"
                  style={{ ["--share" as string]: `${(option.votes / top) * 100}%` }}
                />
                <span className="ballot-value">
                  {type === "date" ? formatDateValue(option.value) : option.value}
                </span>
                <span className="ballot-people" aria-hidden="true">
                  {option.voters.slice(0, 4).map((voter) => (
                    <Avatar key={voter.id} url={voter.url} name={voter.name} size={20} />
                  ))}
                </span>
                <span className="ballot-count">
                  {option.votes}
                  <span className="sr-only"> votes</span>
                </span>
              </button>

              {option.createdByMe && !locked && (
                <button
                  className="ballot-remove"
                  type="button"
                  aria-label={`Remove ${option.value}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeOption(option.id, planId, slug);
                    })
                  }
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <div className="ballot-add">
          <input
            type={type === "date" ? "date" : "text"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            maxLength={200}
            aria-label={placeholder}
          />
          <button
            className="btn btn-room"
            type="button"
            onClick={submit}
            disabled={pending || !draft.trim()}
          >
            Suggest
          </button>
        </div>
      )}

      {error && (
        <p className="inline-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Date options are stored as ISO so they can be locked straight onto the plan. */
function formatDateValue(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? shortDate(value) : value;
}
