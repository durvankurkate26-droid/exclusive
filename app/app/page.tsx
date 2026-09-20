import { redirect } from "next/navigation";
import { getMyGroups, getProfile, getUser } from "@/lib/data/session";

/**
 * The resolver.
 *
 * `proxy.ts` cannot answer "where should this person land?" — that needs the database,
 * and the proxy runs on every request including prefetches. So every post-auth path
 * points here instead, and this one route does the three lookups once and forwards.
 *
 *   no session          -> /login
 *   profile unfinished  -> /onboarding
 *   no groups yet       -> /groups
 *   otherwise           -> their most recently active group
 */
export const dynamic = "force-dynamic";

export default async function AppResolver() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || !profile.onboarded_at) redirect("/onboarding");

  const groups = await getMyGroups();
  if (groups.length === 0) redirect("/groups");

  redirect(`/g/${groups[0].group.slug}`);
}
