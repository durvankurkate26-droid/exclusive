"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { completeOnboarding, type FormState } from "@/lib/actions/profile";
import { createGroup, joinGroup } from "@/lib/actions/groups";

function Submit({ children, pendingLabel }: { children: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="auth-submit" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function Notice({ state }: { state: FormState }) {
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
  return <p className="auth-notice" aria-hidden="true" />;
}

export function OnboardingForm({
  defaultName,
  defaultUsername,
}: {
  defaultName: string;
  defaultUsername: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(completeOnboarding, {});

  return (
    <div className="auth-card">
      <form action={action} noValidate>
        <div className="auth-field">
          <label htmlFor="display_name">WHAT THEY CALL YOU</label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            autoComplete="nickname"
            defaultValue={defaultName}
            placeholder="Durvankur"
            maxLength={40}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="username">USERNAME</label>
          <input
            id="username"
            name="username"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={defaultUsername}
            placeholder="durvankur"
            pattern="[a-z0-9_]{3,20}"
            maxLength={20}
            required
          />
          <p className="auth-hint">lowercase, numbers and _ · 3–20 characters</p>
        </div>
        <Submit pendingLabel="Saving…">That&apos;s me ↗</Submit>
      </form>
      <Notice state={state} />
    </div>
  );
}

export function CreateGroupForm() {
  const [state, action] = useActionState<FormState, FormData>(createGroup, {});

  return (
    <div className="auth-card">
      <form action={action} noValidate>
        <div className="auth-field">
          <label htmlFor="name">GROUP NAME</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="EXCLUSIVE TEA"
            maxLength={60}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="description">WHAT IS THIS GROUP (OPTIONAL)</label>
          <input
            id="description"
            name="description"
            type="text"
            placeholder="the ones who were there"
            maxLength={140}
          />
        </div>
        <Submit pendingLabel="Building the room…">Start the group ↗</Submit>
      </form>
      <Notice state={state} />
      <p className="auth-switch">
        Someone already made one? <Link href="/groups/join">Join instead</Link>
      </p>
    </div>
  );
}

export function JoinGroupForm({ defaultCode }: { defaultCode?: string }) {
  const [state, action] = useActionState<FormState, FormData>(joinGroup, {});

  return (
    <div className="auth-card">
      <form action={action} noValidate>
        <div className="auth-field">
          <label htmlFor="code">INVITE CODE</label>
          <input
            id="code"
            name="code"
            type="text"
            // The codes are generated uppercase and read aloud in a group chat, so the
            // field does the shouting rather than asking the reader to.
            className="code-input"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={defaultCode}
            placeholder="XKCD7RM"
            maxLength={12}
            required
          />
        </div>
        <Submit pendingLabel="Knocking…">Let me in ↗</Submit>
      </form>
      <Notice state={state} />
      <p className="auth-switch">
        No code? <Link href="/groups/create">Start your own</Link>
      </p>
    </div>
  );
}
