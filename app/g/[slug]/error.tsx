"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * A room failed to load. Plain words, one way forward: try the same room again
 * (which re-fetches it) or step back to Home. The shell stays up around it, so the
 * rest of the house is still one tap away. Errors are not where this product jokes.
 */
export default function RoomError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[room]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="empty" role="alert">
      <p className="empty-line">This room didn&apos;t load.</p>
      <p className="empty-hint">
        Probably the connection, possibly us. Nothing you did was lost. Try it again, or head back to Home.
        {error.digest && <span className="meta"> Reference {error.digest}</span>}
      </p>
      <div className="form-row">
        <button className="btn btn-lit" type="button" onClick={() => retry()}>
          Try again
        </button>
        <Link className="btn btn-ghost" href="/app">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
