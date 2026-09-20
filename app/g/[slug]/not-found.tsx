import Link from "next/link";

export default function GroupNotFound() {
  return (
    <div className="auth-screen">
      <div className="auth-ambient" aria-hidden="true" />
      <main className="auth-main">
        <div className="auth-intro">
          <p className="auth-kicker">↳ NOTHING HERE</p>
          <h1 className="auth-title">
            WRONG
            <br />
            <span>DOOR.</span>
          </h1>
          <p className="auth-sub">
            This group doesn&apos;t exist, or you&apos;re not in it. Those look the same
            from out here — on purpose.
          </p>
        </div>
        <div className="auth-card">
          <Link className="auth-submit entry-choice-primary" href="/app">
            Back to your groups ↗
          </Link>
        </div>
      </main>
    </div>
  );
}
