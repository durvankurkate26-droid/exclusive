import type { Metadata } from "next";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "New password · EXCLUSIVE" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthIntro
        kicker="↳ ALMOST THERE"
        title={
          <>
            NEW KEY,
            <br />
            <span>SAME ROOM.</span>
          </>
        }
      >
        Pick something you&apos;ll actually remember.
      </AuthIntro>
      <ResetPasswordForm />
    </>
  );
}
