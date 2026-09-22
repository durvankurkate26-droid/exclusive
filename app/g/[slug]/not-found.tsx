import Link from "next/link";

/** Inside a group: a tea, plan or memory that isn't there (or isn't yours to see). */
export default function GroupNotFound() {
  return (
    <div className="empty">
      <p className="empty-line">
        Wrong door.
        <span>Nothing here.</span>
      </p>
      <p className="empty-hint">
        It was deleted, or it belongs to another group. Those look the same from out here, on purpose.
      </p>
      <Link className="btn" href="/app">Back to your groups</Link>
    </div>
  );
}
