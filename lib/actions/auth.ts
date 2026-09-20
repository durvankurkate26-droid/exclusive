"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";

/**
 * Auth server actions.
 *
 * Server Actions run only on the server, so credentials never pass through client
 * JavaScript and there is no API route to protect separately. Each returns a plain
 * `{ error }` shape for `useActionState` rather than throwing, because a wrong
 * password is an expected outcome of a form, not an exception.
 */

export type AuthState = { error?: string; message?: string };

/** Only ever redirect to a path on this origin. A full URL here is an open redirect. */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  if (!value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) return { error: "Email and password, please." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase returns the same message for unknown email and wrong password, which
    // is correct — distinguishing them would let anyone enumerate who has an account.
    return { error: "That email and password don't match anything here." };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) return { error: "That email isn't going to work." };
  if (password.length < 8) return { error: "8 characters minimum. Make it a good one." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });

  if (error) {
    return { error: error.message };
  }

  // When "Confirm email" is on, Supabase returns a user with no session. Telling the
  // reader to go and check their inbox is the whole difference between this working
  // and looking broken.
  if (data.user && !data.session) {
    return {
      message: "Check your email to confirm. Then come back and sign in.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Google OAuth.
 *
 * `signInWithOAuth` on the server does not redirect by itself — it hands back the
 * provider URL and expects the caller to send the browser there. The PKCE verifier is
 * written to a cookie by the server client on the way past, and `/auth/callback`
 * trades it for a session on the way back.
 */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent("Google sign-in is unavailable.")}`);
  }

  redirect(data.url);
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "That email isn't going to work." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });

  // Deliberately unconditional: confirming whether an address is registered is an
  // account-enumeration leak.
  return { message: "If that address is here, a reset link is on its way." };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "8 characters minimum." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/app");
}
