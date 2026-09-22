"use client";

import { useStoredValue } from "@/lib/client-store";

/**
 * A dot for teas that moved since you last opened them on this device. Reads the
 * same localStorage key the room writes; renders nothing on the server (and during
 * hydration), so there is no mismatch and no dot for teas you have never opened.
 */
export function UnreadDot({ teaId, updatedAt }: { teaId: string; updatedAt: string }) {
  const seen = useStoredValue(`tea-seen:${teaId}`);
  if (!seen || seen >= updatedAt) return null;
  return (
    <span className="tea-unread-dot">
      <span className="sr-only">new messages</span>
    </span>
  );
}
