import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

/**
 * The viewer's IANA time zone, from the `tz` cookie the root layout writes. Validated
 * by asking Intl to use it, so a hand-edited cookie can't throw inside a render.
 * Falls back to UTC on a first visit, before the cookie exists.
 */
export const getTimeZone = cache(async (): Promise<string> => {
  const raw = (await cookies()).get("tz")?.value;
  if (!raw) return "UTC";
  try {
    const zone = decodeURIComponent(raw);
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
});
