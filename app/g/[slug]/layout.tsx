import { AppShell } from "@/components/app/AppShell";
import { requireGroup } from "@/lib/data/session";
import "../../app.css";

/**
 * Every authenticated room lives under here.
 *
 * `requireGroup` is the real gate: it resolves the slug, proves membership and 404s
 * otherwise. The proxy's redirect is a convenience for signed-out visitors; this is
 * the check that stops a member of one group reading another's by URL — and Row Level
 * Security stops it again underneath, so a mistake here is not a breach.
 */
export default async function GroupLayout({
  children,
  params,
}: LayoutProps<"/g/[slug]">) {
  const { slug } = await params;
  const { profile, group, role } = await requireGroup(slug);

  return (
    <AppShell profile={profile} group={group} role={role}>
      {children}
    </AppShell>
  );
}
