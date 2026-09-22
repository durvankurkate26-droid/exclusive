import "server-only";

/**
 * What a person sees when a write fails.
 *
 * Raw Postgres/PostgREST messages ("new row violates row-level security policy for
 * table plan_votes") are for us, not for someone voting on Saturday. The technical
 * detail goes to the server log with the code; the person gets a sentence that says
 * what happened and what to do. Copy stays plain on purpose: errors are not where
 * this product is funny.
 */
type DbError = { message?: string; code?: string; details?: string | null } | null | undefined;

export function friendly(error: DbError, context = "write"): string {
  console.error(`[${context}] ${error?.code ?? "?"}: ${error?.message ?? "unknown error"}`, error?.details ?? "");
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "23505") return "That's already there.";
  if (code === "23514" || code === "22001") return "That doesn't fit. Check the length and try again.";
  if (code === "23503") return "Something it points to was deleted. Refresh and try again.";
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    return "You can't change that in this group. If you should be able to, ask an admin.";
  }
  if (code === "PGRST116") return "That's gone. Someone may have deleted it. Refresh to see what's there now.";
  if (/fetch failed|network|timeout|ECONN/i.test(message)) return "Couldn't reach the server. Check your connection and try again.";
  return "That didn't save. Try again in a moment.";
}
