"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { type AuthState, signIn, signUp } from "@/lib/actions/auth";
import {
  DoorState,
  EmailField,
  GoogleButton,
  Notice,
  PasswordField,
  Submit,
} from "@/components/auth/AuthForms";
import { Shot } from "./Shot";

/**
 * The door, for real.
 *
 * This section used to be a UI-only form that validated, sent nothing, and said "auth
 * ships next" -- while the product's real auth already existed one route away. It now
 * posts to the same server actions as /signup and /login, so creating an account here
 * is creating an account.
 *
 * The copy is also held to what the product actually does. Anyone can make an account;
 * what is private is the group: a room only opens to the people its members invite.
 * The old "INVITE-ONLY" eyebrow claimed more than that, so it is gone.
 */
type Mode = "signup" | "signin";

function AccessForm() {
  const [mode, setMode] = useState<Mode>("signup");
  const [upState, upAction] = useActionState<AuthState, FormData>(signUp, {});
  const [inState, inAction] = useActionState<AuthState, FormData>(signIn, {});
  const signup = mode === "signup";
  const state = signup ? upState : inState;

  return (
    <div className="access-door">
      <h3 className="access-door-title">MAKE A ROOM FOR YOUR PEOPLE.</h3>

      <div className="access-modes" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={signup} onClick={() => setMode("signup")}>
          New here
        </button>
        <button type="button" role="tab" aria-selected={!signup} onClick={() => setMode("signin")}>
          I have an account
        </button>
        <i aria-hidden="true" data-mode={mode} />
      </div>

      <div className="auth-card">
        <GoogleButton />
        <p className="auth-divider" aria-hidden="true">
          <span>OR WITH EMAIL</span>
        </p>
        {/* Keyed on mode so switching resets the fields and the pending state. */}
        <form key={mode} action={signup ? upAction : inAction} noValidate>
          <DoorState state={state} />
          <EmailField id={`access-email-${mode}`} />
          <PasswordField id={`access-password-${mode}`} fresh={signup} />
          {signup ? (
            <Submit pendingLabel="Making room…">Enter EXCLUSIVE</Submit>
          ) : (
            <Submit pendingLabel="Checking…">Sign in</Submit>
          )}
        </form>
        <Notice state={state} />
        {!signup && (
          <p className="auth-switch">
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function FinalCTA() {
  return (
    <section id="access" className="final-cta access" aria-labelledby="access-title">
      <div className="access-grid">
        <div className="access-story">
          {/* Four real photographs, overlapping and partly cut by the column edge.
              The headline sits across their lower edge. */}
          <div className="access-photos" aria-hidden="true">
            <Shot id="canteenTrio" decorative sizes="(max-width: 900px) 56vw, 26vw" className="ap ap-1" />
            <Shot id="redThreads" decorative sizes="(max-width: 900px) 30vw, 14vw" className="ap ap-2" />
            <Shot id="tongueSelfie" decorative sizes="(max-width: 900px) 24vw, 10vw" className="ap ap-3" />
            <Shot id="forestFlex" decorative sizes="(max-width: 900px) 34vw, 15vw" className="ap ap-4" />
          </div>
          <p className="access-lead">The group chat was never the problem.</p>
          <h2 id="access-title">
            EVERYTHING GETTING
            <br />
            <span>LOST IN IT WAS.</span>
          </h2>
          <p className="access-sub">
            Anyone can make an account. A group only opens to the people its members invite.
          </p>
        </div>

        <AccessForm />
      </div>

      <footer>
        <span className="footer-brand">EXCLUSIVE</span>
        <span>TEA · CREATE · ONE DAY · ALIGN · VAULT</span>
        <span>© 2026 · STILL AWAKE</span>
      </footer>
    </section>
  );
}
