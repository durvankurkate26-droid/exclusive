import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / email-confirmation landing.
 *
 * Supabase sends the browser back here with a one-time `code`. Exchanging it sets the
 * session cookies — which a Route Handler is allowed to do, unlike a Server Component.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/app";
  // Never follow an absolute URL from the query string.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  if (!code) {
    const reason = searchParams.get("error_description") ?? "Sign-in was cancelled.";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That sign-in link has expired.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
