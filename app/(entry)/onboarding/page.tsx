import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { OnboardingForm } from "@/components/entry/EntryForms";
import { getProfile, getUser } from "@/lib/data/session";

export const metadata: Metadata = { title: "Who are you? · EXCLUSIVE" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // The handle_new_user trigger has already made a row with provider values in it,
  // so this is a confirmation step, not a blank form.
  const profile = await getProfile();
  if (profile?.onboarded_at) redirect("/app");

  return (
    <>
      <AuthIntro
        kicker="↳ ONE LAST THING"
        title={
          <>
            WHO ARE YOU
            <br />
            <span>IN HERE?</span>
          </>
        }
      >
        This is what your people will see. You can change it later.
      </AuthIntro>
      <OnboardingForm
        defaultName={profile?.display_name ?? ""}
        defaultUsername={profile?.username ?? ""}
      />
    </>
  );
}
