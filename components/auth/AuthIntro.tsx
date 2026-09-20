import type { ReactNode } from "react";

/**
 * The left pole of the auth screen: kicker, statement, one line of context.
 *
 * A component rather than three loose elements per page, because the grid places it
 * as a single area — three siblings assigned to the same area would stack on top of
 * each other instead of reading as a block.
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
      <p className="auth-kicker">{kicker}</p>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-sub">{children}</p>
    </div>
  );
}
