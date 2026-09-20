/**
 * One place that answers "is the backend wired up yet?".
 *
 * Reading `process.env.X!` at module scope is the usual shortcut and it fails badly
 * here: a missing key throws deep inside the Supabase client during render, which in
 * the App Router surfaces as an opaque digest-only error. EXCLUSIVE is also a project
 * someone will clone before they have a Supabase project, so "not configured" is a
 * real state the app should be able to say out loud rather than crash on.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until `.env.local` has both public values. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * The origin Supabase redirects back to after OAuth and email confirmation.
 *
 * Falls back to the request-time origin in the browser so that preview deployments
 * and `localhost` both work without a rebuild.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** Throw with a message that says what to do, not just what broke. */
export function assertSupabaseConfigured(): void {
  if (isSupabaseConfigured) return;
  throw new Error(
    "Supabase is not configured. Copy .env.example to .env.local and set " +
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}
