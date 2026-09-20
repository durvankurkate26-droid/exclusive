import Link from "next/link";
import type { ReactNode } from "react";
import "../entry.css";

/**
 * The threshold.
 *
 * Deliberately the quietest screen in the product: the landing page is loud so that
 * this can be still. Same midnight base and same type, one slow ambient light, and
 * nothing that moves while someone is typing a password.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-ambient" aria-hidden="true" />
      <header className="auth-top">
        <Link className="auth-brand" href="/">
          EXCLUSIVE
        </Link>
        <span className="auth-top-note">MEMBERS ONLY</span>
      </header>
      <main className="auth-main">{children}</main>
    </div>
  );
}
