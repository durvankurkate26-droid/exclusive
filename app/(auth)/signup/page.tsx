import type { Metadata } from "next";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { SignUpForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create account · EXCLUSIVE" };

export default function SignUpPage() {
  return (
    <>
      <AuthIntro
        kicker="↳ INVITE-ONLY · BY YOUR PEOPLE"
        title={
          <>
            MAKE YOUR
            <br />
            <span>KEY.</span>
          </>
        }
      >
        One account. Then your group adds you, or you start one.
      </AuthIntro>
      <SignUpForm />
    </>
  );
}
