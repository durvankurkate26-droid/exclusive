"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  type AuthState,
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  updatePassword,
} from "@/lib/actions/auth";

/**
 * Auth forms.
 *
 * `useActionState` + `useFormStatus` rather than a form library: the actions already
 * validate on the server, which is the only place validation counts, and adding
 * react-hook-form + zod here would mean two sources of truth for four fields.
 *
 * The pieces are exported because the landing page's access section is the same door
 * with a different room around it: it composes these rather than keeping a second,
 * fake copy of the form.
 */

/** `useFormStatus` only reports on a form it is *inside*, hence its own component. */
export function Submit({ children, pendingLabel }: { children: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="auth-submit" type="submit" disabled={pending} aria-busy={pending}>
      <span>{pending ? pendingLabel : children}</span>
      <i aria-hidden="true">→</i>
    </button>
  );
}

/**
 * Where you are relative to the door, read from real form state only. It says
 * "checking" exactly as long as the server action is actually running and never
 * plays a fake verification beat.
 */
export function DoorState({ state }: { state: AuthState }) {
  const { pending } = useFormStatus();
  const phase = pending ? "checking" : state.message ? "almost" : "outside";
  const label = { outside: "YOU'RE OUTSIDE", checking: "CHECKING THE DOOR", almost: "ONE STEP LEFT" }[phase];
  return (
    <p className="door-state" data-phase={phase} aria-hidden="true">
      <i />
      {label}
    </p>
  );
}

/** Google's mark, inlined — no third-party script, no network request. */
export function GoogleMark() {
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

function GooglePending() {
  const { pending } = useFormStatus();
  return (
    <button className="auth-provider" type="submit" disabled={pending} aria-busy={pending}>
      <GoogleMark />
      {pending ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

/** Google's dark-theme button: the standard mark on #131314, unmodified. */
export function GoogleButton({ next }: { next?: string }) {
  return (
    <form action={signInWithGoogle}>
      {next && <input type="hidden" name="next" value={next} />}
      <GooglePending />
    </form>
  );
}

export function Notice({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p className="auth-notice is-error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="auth-notice" role="status">
        {state.message}
      </p>
    );
  }
  // Reserve the space so the form does not jump when a message appears.
  return <p className="auth-notice" aria-hidden="true" />;
}

export function EmailField({ id = "email" }: { id?: string }) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>EMAIL</label>
      <input
        id={id}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@wherever.com"
        required
      />
    </div>
  );
}

export function PasswordField({ id = "password", fresh }: { id?: string; fresh?: boolean }) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>PASSWORD</label>
      <input
        id={id}
        name="password"
        type="password"
        autoComplete={fresh ? "new-password" : "current-password"}
        placeholder={fresh ? "8+ characters" : "your password"}
        minLength={fresh ? 8 : undefined}
        required
      />
    </div>
  );
}

export function SignInForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {
    error: initialError,
  });

  return (
    <div className="auth-card">
      <GoogleButton next={next} />

      <p className="auth-divider" aria-hidden="true">
        <span>OR WITH EMAIL</span>
      </p>

      <form action={action} noValidate>
        <DoorState state={state} />
        {next && <input type="hidden" name="next" value={next} />}
        <EmailField />
        <PasswordField />
        <Submit pendingLabel="Checking…">Sign in</Submit>
      </form>

      <Notice state={state} />

      <p className="auth-switch">
        <Link href="/forgot-password">Forgot password?</Link>
        <span aria-hidden="true">·</span>
        <Link href="/signup">Create account</Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});

  return (
    <div className="auth-card">
      <GoogleButton />

      <p className="auth-divider" aria-hidden="true">
        <span>OR WITH EMAIL</span>
      </p>

      <form action={action} noValidate>
        <DoorState state={state} />
        <EmailField />
        <PasswordField fresh />
        <Submit pendingLabel="Making room…">Enter EXCLUSIVE</Submit>
      </form>

      <Notice state={state} />

      <p className="auth-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <div className="auth-card">
      <form action={action} noValidate>
        <EmailField />
        <Submit pendingLabel="Sending…">Send reset link</Submit>
      </form>

      <Notice state={state} />

      <p className="auth-switch">
        Remembered it? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <div className="auth-card">
      <form action={action} noValidate>
        <div className="auth-field">
          <label htmlFor="password">NEW PASSWORD</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="8+ characters"
            minLength={8}
            required
          />
        </div>
        <Submit pendingLabel="Saving…">Set password</Submit>
      </form>
      <Notice state={state} />
    </div>
  );
}
