import type { Metadata } from "next";
import Link from "next/link";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { getMyGroups, requireProfile } from "@/lib/data/session";

export const metadata: Metadata = { title: "Your groups · EXCLUSIVE" };
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  await requireProfile();
  const groups = await getMyGroups();

  return (
    <>
      <AuthIntro
        kicker="↳ NO ROOM YET"
        title={
          <>
            FIND YOUR
            <br />
            <span>PEOPLE.</span>
          </>
        }
      >
        EXCLUSIVE only works with the people you&apos;d actually text at 2am.
      </AuthIntro>

      <div className="auth-card">
        {groups.length > 0 && (
          <ul className="group-list">
            {groups.map(({ group, role }) => (
              <li key={group.id}>
                <Link href={`/g/${group.slug}`}>
                  <span className="group-list-name">{group.name}</span>
                  <span className="group-list-role">{role}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="entry-choice">
          <Link className="auth-submit entry-choice-primary" href="/groups/create">
            Start a group ↗
          </Link>
          <Link className="auth-provider" href="/groups/join">
            I have an invite code
          </Link>
        </div>
      </div>
    </>
  );
}
