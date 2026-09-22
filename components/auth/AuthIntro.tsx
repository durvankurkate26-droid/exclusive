import type { ReactNode } from "react";
import { Shot } from "@/components/landing/Shot";

/**
 * The left pole of the auth screen: three of the group's photographs, then kicker,
 * statement and one line of context.
 *
 * The photos are the same prints the landing page ends on, so crossing into sign-in
 * reads as walking through the door you were just looking at, not landing on a
 * generic form. They are small and still on purpose: nothing moves while someone is
 * typing a password.
 */
export function AuthIntro({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="auth-intro">
      <div className="auth-photos" aria-hidden="true">
        <Shot id="canteenTrio" decorative eager sizes="(max-width: 900px) 46vw, 18rem" className="auth-ph auth-ph-1" />
        <Shot id="redThreads" decorative eager sizes="(max-width: 900px) 24vw, 8rem" className="auth-ph auth-ph-2" />
        <Shot id="corridorTongue" decorative eager sizes="(max-width: 900px) 32vw, 12rem" className="auth-ph auth-ph-3" />
      </div>
      <p className="auth-kicker">{kicker}</p>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-sub">{children}</p>
    </div>
  );
}
