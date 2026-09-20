import type { Metadata } from "next";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { JoinGroupForm } from "@/components/entry/EntryForms";
import { requireProfile } from "@/lib/data/session";

export const metadata: Metadata = { title: "Join a group · EXCLUSIVE" };
export const dynamic = "force-dynamic";

export default async function JoinGroupPage() {
  await requireProfile();
  return (
    <>
      <AuthIntro
        kicker="↳ SOMEONE SENT YOU"
        title={
          <>
            WHAT&apos;S THE
            <br />
            <span>CODE?</span>
          </>
        }
      >
        Seven characters. It&apos;s in the chat somewhere.
      </AuthIntro>
      <JoinGroupForm />
    </>
  );
}
