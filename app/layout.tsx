import type { Metadata } from "next";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EXCLUSIVE — Members Only",
  description: "A private digital space for everything beyond the group chat.",
  icons: { icon: "/favicon.svg" },
};

/**
 * Tells the server which time zone this browser is in, so server-rendered clock times
 * (and the client components that hydrate over them) agree with the viewer's wall
 * clock. A cookie rather than a header because it has to survive into the next
 * request; written only when it changes.
 */
const TZ_COOKIE = `try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z&&document.cookie.indexOf("tz="+encodeURIComponent(z))<0)document.cookie="tz="+encodeURIComponent(z)+";path=/;max-age=31536000;samesite=lax"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: TZ_COOKIE }} />
        {children}
      </body>
    </html>
  );
}
