import type { Metadata } from "next";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { SignUpForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create account · EXCLUSIVE" };

export default function SignUpPage() {
  return (
    <>
      <AuthIntro
        kicker="↳ PRIVATE BY DESIGN"
        title={
          <>
            YOU&apos;RE ALMOST
            <br />
            <span>INSIDE.</span>
          </>
        }
      >
        One account. Then start a group, or join the one your friends already made.
      </AuthIntro>
      <SignUpForm />
    </>
  );
}
