import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { JoinGroupForm } from "@/components/entry/EntryForms";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/data/session";

export const metadata: Metadata = { title: "You're invited · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * Invite link: /join/XKCD7RM
 *
 * Shows the group's name and size before asking anyone to commit — an invite that
 * just says "join?" with no context is how people end up in the wrong group. The
 * preview comes from a SECURITY DEFINER RPC that returns only the name, the blurb and
 * a count, because the visitor is not a member yet and RLS correctly hides everything
 * else from them.
 */
export default async function InvitePage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const normalised = code.trim().toUpperCase();

  const user = await getUser();
  if (!user) {
    // Send them through auth and straight back to this invite.
    redirect(`/login?next=${encodeURIComponent(`/join/${normalised}`)}`);
  }

  const profile = await getProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invite_preview", { code: normalised });
  const preview = Array.isArray(data) ? data[0] : data;

  if (!preview) {
    return (
      <>
        <AuthIntro
          kicker="↳ DEAD END"
          title={
            <>
              THAT CODE
              <br />
              <span>ISN&apos;T REAL.</span>
            </>
          }
        >
          Either it expired or someone typed it wrong. Ask again.
        </AuthIntro>
        <JoinGroupForm />
      </>
    );
  }

  if (preview.already_member) {
    return (
      <>
        <AuthIntro
          kicker="↳ YOU'RE ALREADY IN"
          title={
            <>
              {preview.name.toUpperCase()}
              <br />
              <span>IS YOURS.</span>
            </>
          }
        >
          Nothing to do here.
        </AuthIntro>
        <div className="auth-card">
          <a className="auth-submit entry-choice-primary" href="/app">
            Go to the group ↗
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthIntro
        kicker="↳ YOU'VE BEEN INVITED"
        title={
          <>
            {preview.name.toUpperCase()}
            <br />
            <span>WANTS YOU IN.</span>
          </>
        }
      >
        {preview.description
          ? preview.description
          : `${preview.member_count} ${preview.member_count === 1 ? "person is" : "people are"} already inside.`}
      </AuthIntro>
      <JoinGroupForm defaultCode={normalised} />
    </>
  );
}
