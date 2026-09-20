import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, assertSupabaseConfigured } from "./env";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client, bound to the request's cookies.
 *
 * `cookies()` is async in Next 15+, so this is too — every caller must await it.
 *
 * The `setAll` catch is not laziness. Server Components are not allowed to write
 * cookies, but this same client is used in them for reads; when Supabase tries to
 * persist a refreshed token during a render, the write throws. Swallowing it is safe
 * *because* `proxy.ts` refreshes the session on every request, so the refreshed token
 * is always written somewhere that is allowed to write it. Remove the proxy and this
 * becomes a silent logout bug.
 */
export async function createClient() {
  assertSupabaseConfigured();
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component render — the proxy owns the write. See note above.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses Row Level Security completely.
 *
 * Never import this from anything that can reach the browser. It exists for the demo
 * seed script and nothing else; every application path goes through the anon client
 * so that RLS stays the enforcement boundary.
 */
export async function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only).");
  // Imported lazily so the service-role path is never pulled into a client bundle.
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  return createSupabaseClient<Database>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
