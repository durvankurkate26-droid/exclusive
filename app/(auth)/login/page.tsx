import type { Metadata } from "next";
import { AuthIntro } from "@/components/auth/AuthIntro";
import { SignInForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign in · EXCLUSIVE" };

// Next 16 generates `PageProps<'/route'>` from the app directory; params and
// searchParams are Promises on it, and hand-written shapes no longer satisfy the
// route validator.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const raw = await searchParams;
  // Search params are `string | string[] | undefined` — a repeated key gives an array.
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = first(raw.next);
  const error = first(raw.error);

  return (
    <>
      <AuthIntro
        kicker="↳ ENTER THE ROOM"
        title={
          <>
            WELCOME
            <br />
            <span>BACK IN.</span>
          </>
        }
      >
        The room&apos;s been quiet without you.
      </AuthIntro>
      <SignInForm next={next} initialError={error} />
    </>
  );
}
