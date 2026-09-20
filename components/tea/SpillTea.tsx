"use client";

import { useTransition } from "react";
import { setTeaStatus } from "@/lib/actions/tea";
import type { TeaStatus } from "@/lib/supabase/database.types";

/**
 * Closing a conversation.
 *
 * "Spill it" ends the thread — the tea is out, nothing more to add. Reopening is
 * allowed because groups change their minds, and an irreversible button on a
 * conversation would just mean people never press it.
 */
export function SpillTea({
  teaId,
  slug,
  status,
}: {
  teaId: string;
  slug: string;
  status: TeaStatus;
}) {
  const [pending, startTransition] = useTransition();

  const set = (next: TeaStatus) =>
    startTransition(() => {
      void setTeaStatus(teaId, slug, next);
    });

  if (status === "brewing") {
    return (
      <button
        className="btn btn-room"
        type="button"
        onClick={() => set("spilled")}
        disabled={pending}
      >
        {pending ? "…" : "Spill it"}
      </button>
    );
  }

  return (
    <button
      className="btn"
      type="button"
      onClick={() => set("brewing")}
      disabled={pending}
    >
      {pending ? "…" : "Reopen"}
    </button>
  );
}
