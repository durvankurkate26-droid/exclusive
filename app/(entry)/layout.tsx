import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/lib/actions/auth";
import "../entry.css";

/**
 * Onboarding, group creation and invites share the auth shell.
 *
 * These are all "you are signed in but not yet anywhere" screens, so they read as a
 * continuation of the threshold rather than as the product. The difference from the
 * auth layout is the sign-out affordance: by this point there is a session, and a
 * reader stuck on the wrong account needs a way back out.
 */
export default function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-ambient" aria-hidden="true" />
      <header className="auth-top">
        <Link className="auth-brand" href="/">
          EXCLUSIVE
        </Link>
        <form action={signOut}>
          <button className="auth-top-note auth-signout" type="submit">
            SIGN OUT
          </button>
        </form>
      </header>
      <main className="auth-main">{children}</main>
    </div>
  );
}
