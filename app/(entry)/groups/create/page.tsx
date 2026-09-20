import type { Metadata } from "next";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { CreateGroupForm } from "@/components/entry/EntryForms";
import { requireProfile } from "@/lib/data/session";

export const metadata: Metadata = { title: "Start a group · EXCLUSIVE" };
export const dynamic = "force-dynamic";

export default async function CreateGroupPage() {
  await requireProfile();
  return (
    <>
      <AuthIntro
        kicker="↳ SOMEONE HAS TO START IT"
        title={
          <>
            NAME THE
            <br />
            <span>ROOM.</span>
          </>
        }
      >
        You&apos;ll get a code to pass around. Nine people is a good number.
      </AuthIntro>
      <CreateGroupForm />
    </>
  );
}
