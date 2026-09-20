import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

/**
 * `proxy.ts`, not `middleware.ts`.
 *
 * Next 16 deprecated the `middleware` file convention and renamed it to `proxy`, with
 * the export renamed to match. Every Supabase SSR tutorial still says `middleware.ts`;
 * in this version that file is dead code that silently never runs, which would mean
 * tokens are never refreshed and users get logged out roughly every hour.
 *
 * Two jobs here, and only two:
 *
 *  1. Refresh the auth token. Server Components cannot write cookies, so the server
 *     client in `lib/supabase/server.ts` swallows its cookie writes. This is the place
 *     that is allowed to write them, which is what makes that swallow safe.
 *
 *  2. Optimistic redirects. Per the Next auth guide, this runs on every request
 *     including prefetches, so it only ever reads the session — no database queries,
 *     no membership checks. Real authorization lives in the Data Access Layer and,
 *     underneath that, in Row Level Security. A redirect here is a convenience, never
 *     a security boundary.
 */

/** Routes a signed-out visitor may see. Everything else requires a session. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

/** Prefixes that are always allowed through (auth handshake, assets, metadata). */
const ALWAYS_OPEN = ["/auth/", "/_next/", "/favicon", "/images/", "/models/"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return ALWAYS_OPEN.some((prefix) => pathname.startsWith(prefix));
}

export default async function proxy(request: NextRequest) {
  // Without credentials there is no session to refresh and nothing to protect.
  // Let everything through so the landing page still works on a fresh clone.
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Must be getUser(), not getSession(): getSession() trusts the cookie without
  // contacting the auth server, so it cannot detect a revoked or expired token — and
  // calling it here is also what triggers the refresh-and-write above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where they were going so login can send them back. Only the path is
    // kept, never an absolute URL — an attacker-supplied `next` is an open redirect.
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // A signed-in user on an auth page goes to the resolver, which decides between
  // onboarding, group setup and their group home. That decision needs the database,
  // so it belongs in a route, not here.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Note this deliberately does
     * still run on /auth/* so the OAuth callback gets a refreshed cookie jar.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|woff2?)$).*)",
  ],
};
