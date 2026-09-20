"use client";

import { FormEvent, useId, useState } from "react";
import { Reveal } from "./Reveal";

/**
 * The door.
 *
 * This was a single free-text field labelled "your @ or number" with `autocomplete="tel"`
 * -- a phone-first waitlist for a product that is not going to authenticate by phone.
 * The shipped direction is Google OAuth plus email/password, so the entry UI is that:
 * the provider button first, then the credential form, with a mode switch between
 * signing in and creating an account.
 *
 * Deliberately UI-only. Nothing here posts anywhere, because the auth backend is the
 * next piece of work and a form that silently swallows a password is worse than one that
 * admits it is not wired. The submit handler validates and says so.
 */
type Mode = "signup" | "signin";

/** Google's mark, inlined: four paths, no network request, no third-party script. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export function FinalCTA() {
  const [mode, setMode] = useState<Mode>("signup");
  const [message, setMessage] = useState("");
  const emailId = useId();
  const passwordId = useId();
  const signup = mode === "signup";

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email.includes("@")) return setMessage("that email isn’t going to work 👀");
    if (password.length < 8) return setMessage("8 characters minimum. make it a good one.");
    setMessage("doors aren’t open yet — auth ships next. nothing was sent.");
  };

  const onProvider = () =>
    setMessage("google sign-in ships with the backend. nothing was sent.");

  return (
    <section id="access" className="final-cta" aria-labelledby="access-title">
      <Reveal className="cta-inner">
        <p className="eyebrow text-[var(--pink)]">INVITE-ONLY · BY YOUR PEOPLE</p>
        <h2 id="access-title">
          NOT FOR EVERYONE.
          <br />
          <span>JUST FOR YOURS.</span>
        </h2>
        <p>
          Every room is opened by someone already inside. Make your account now — the
          invite finds you.
        </p>

        <div className="auth-card">
          <button className="auth-provider" type="button" onClick={onProvider}>
            <GoogleMark />
            Continue with Google
          </button>

          <p className="auth-divider" aria-hidden="true">
            <span>OR</span>
          </p>

          <form onSubmit={onSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor={emailId}>EMAIL</label>
              <input
                id={emailId}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@wherever.com"
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor={passwordId}>PASSWORD</label>
              <input
                id={passwordId}
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder={signup ? "8+ characters" : "your password"}
                minLength={8}
                required
              />
            </div>
            <button className="auth-submit" type="submit">
              {signup ? "Create account ↗" : "Sign in ↗"}
            </button>
          </form>

          <p className="auth-switch">
            {signup ? "Already have a key?" : "No account yet?"}{" "}
            <button type="button" onClick={() => setMode(signup ? "signin" : "signup")}>
              {signup ? "Sign in" : "Create one"}
            </button>
          </p>
          <div className="form-message" aria-live="polite">
            {message}
          </div>
        </div>
      </Reveal>

      <footer>
        <span className="footer-brand">EXCLUSIVE</span>
        <span>TEA · CREATE · ONE DAY · ALIGN · VAULT</span>
        <span>© 2026 · STILL AWAKE</span>
      </footer>
    </section>
  );
}
