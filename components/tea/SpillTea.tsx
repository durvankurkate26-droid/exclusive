"use client";

import { useTransition } from "react";
import { setTeaStatus } from "@/lib/actions/tea";
import { toast } from "@/components/app/Toast";
import type { TeaStatus } from "@/lib/supabase/database.types";

/**
 * The life of a conversation: brewing → spilled (the tea is out, nothing more to
 * add) or archived (quietly put away). Both are reversible, because a button that
 * can never be undone is a button nobody presses.
 */
export function TeaStatusControls({ teaId, slug, status }: { teaId: string; slug: string; status: TeaStatus }) {
  const [pending, startTransition] = useTransition();

  const set = (next: TeaStatus, message: string) =>
    startTransition(async () => {
      const result = await setTeaStatus(teaId, slug, next);
      if (result.error) toast(result.error, "error");
      else toast(message);
    });

  if (status === "brewing") {
    return (
      <div className="tea-status">
        <button className="btn btn-sm" type="button" disabled={pending} onClick={() => set("spilled", "The tea has been spilled.")}>
          It&apos;s all out
        </button>
        <button className="btn btn-ghost btn-sm" type="button" disabled={pending} onClick={() => set("archived", "Archived. It's still here if you need it.")}>
          Archive
        </button>
      </div>
    );
  }

  return (
    <div className="tea-status">
      <button className="btn btn-sm" type="button" disabled={pending} onClick={() => set("brewing", "Back on. Brewing again.")}>
        Reopen
      </button>
    </div>
  );
}
