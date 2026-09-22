"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * "Someone else just did something here" → re-render from the server.
 *
 * For rooms where the server already computes the whole picture (ALIGN's ballots,
 * ONE DAY's hands), refetching the page is simpler and more correct than patching
 * client state row by row. Refreshes are debounced so a burst of votes is one
 * re-render. Only the tables a room actually shows are subscribed — never everything.
 *
 * Realtime enforces RLS with the socket's token, so the session is attached before
 * subscribing (a cold socket subscribes as anon, sees nothing, and says nothing).
 */
export function useRealtimeRefresh(
  key: string,
  subscriptions: Array<{ table: string; filter?: string }>,
) {
  const router = useRouter();
  const signature = JSON.stringify(subscriptions);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: number | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const subs = JSON.parse(signature) as Array<{ table: string; filter?: string }>;

    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 350);
    };

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase.channel(`refresh:${key}`);
      for (const sub of subs) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: sub.table, filter: sub.filter },
          refresh,
        );
      }
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, signature, router]);
}

/** A tiny client island so server pages can opt into live refresh declaratively. */
export function LiveRefresh({
  id,
  tables,
}: {
  id: string;
  tables: Array<{ table: string; filter?: string }>;
}) {
  useRealtimeRefresh(id, tables);
  return null;
}
