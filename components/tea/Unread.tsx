"use client";

import { useEffect, useState } from "react";

/**
 * A dot for teas that moved since you last opened them on this device. Reads the
 * same localStorage key the room writes; renders nothing on the server, so there is
 * no hydration mismatch and no dot for teas you have never opened at all.
 */
export function UnreadDot({ teaId, updatedAt }: { teaId: string; updatedAt: string }) {
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem(`tea-seen:${teaId}`);
      setUnread(Boolean(seen && seen < updatedAt));
    } catch {}
  }, [teaId, updatedAt]);
  return unread ? <span className="tea-unread-dot"><span className="sr-only">new messages</span></span> : null;
}
