"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, assertSupabaseConfigured } from "./env";
import type { Database } from "./database.types";

/**
 * Browser-side Supabase client.
 *
 * Memoised: `createBrowserClient` opens a Realtime socket and installs auth
 * listeners, so calling it per render would leak a connection per component mount.
 * The same instance is shared by every client component in the tab.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  assertSupabaseConfigured();
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
