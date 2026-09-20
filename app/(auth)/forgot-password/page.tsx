import type { Metadata } from "next";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset password · EXCLUSIVE" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthIntro
        kicker="↳ LOCKED OUT"
        title={
          <>
            HAPPENS TO
            <br />
            <span>EVERYONE.</span>
          </>
        }
      >
        We&apos;ll send a link. No one has to know.
      </AuthIntro>
      <ForgotPasswordForm />
    </>
  );
}
