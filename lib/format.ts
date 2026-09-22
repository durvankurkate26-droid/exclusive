/**
 * Human time.
 *
 * Every formatter here is deterministic: a fixed locale, and an explicit time zone
 * wherever the output depends on one. Formatting with the runtime's defaults gives a
 * different string on the server (UTC, en-US) than in a phone in Mumbai — which in a
 * client component is a hydration error, and in a server component is simply the
 * wrong day.
 *
 *  - Date-only values ("2026-10-17": plan dates, memory dates) are calendar days, not
 *    instants, so they are always formatted in UTC — the 17th is the 17th everywhere.
 *  - Instants (message times) take the viewer's zone, which the server learns from the
 *    `tz` cookie (see `getTimeZone`) and hands to client components as a prop, so both
 *    sides of hydration render the same text.
 */

const LOCALE = "en-GB";
// A bare date, or a timestamp at exactly UTC midnight — which is how a picked day is
// stored in the `timestamptz` plan columns.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}(T00:00:00(\.0+)?(Z|\+00:00|\+00))?$/;

const zoneFor = (iso: string, timeZone?: string) => (DATE_ONLY.test(iso) ? "UTC" : timeZone);

/** An ISO timestamp for `days` ago. A function so render code stays free of `Date.now()`. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Milliseconds since `iso`. */
export function msSince(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

/**
 * "2h ago" rather than a timestamp, because everything in this product is
 * conversational and a date-time stamp reads as a log file. Falls back to a real date
 * past a week, where relative time stops being useful.
 */
export function timeAgo(iso: string, timeZone?: string): string {
  const seconds = Math.round(msSince(iso) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: days > 300 ? "numeric" : undefined,
    timeZone: zoneFor(iso, timeZone),
  });
}

/** "SAT 17 OCT" — the way a date gets said out loud when picking a weekend. */
export function shortDate(iso: string, timeZone?: string): string {
  return new Date(iso)
    .toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone: zoneFor(iso, timeZone) })
    .replace(",", "")
    .toUpperCase();
}

/** "17 OCT" */
export function dayMonth(iso: string, timeZone?: string): string {
  return new Date(iso)
    .toLocaleDateString(LOCALE, { day: "numeric", month: "short", timeZone: zoneFor(iso, timeZone) })
    .toUpperCase();
}

/** "OCTOBER 2026" */
export function monthYear(iso: string, timeZone?: string): string {
  return new Date(iso)
    .toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: zoneFor(iso, timeZone) })
    .toUpperCase();
}

/** Day of the month as a number, e.g. 17. */
export function dayOfMonth(iso: string, timeZone?: string): number {
  return Number(new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", timeZone: zoneFor(iso, timeZone) }));
}

/** "SATURDAY" */
export function weekday(iso: string, timeZone?: string): string {
  return new Date(iso)
    .toLocaleDateString(LOCALE, { weekday: "long", timeZone: zoneFor(iso, timeZone) })
    .toUpperCase();
}

export function fullDate(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: zoneFor(iso, timeZone),
  });
}

/** "11:42 pm" in the given zone. */
export function clockTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit", hour12: true, timeZone });
}

/** "Monday 21 Sep" in the given zone, for day dividers in a conversation. */
export function dayLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "short", timeZone });
}

/**
 * Whole calendar days until a date (negative = past), counted on the same calendar
 * the date is displayed in: UTC for a picked day, local time for a real instant, so
 * "In 2 days" never disagrees with the "25" printed beside it.
 */
export function daysUntil(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  const utc = DATE_ONLY.test(iso);
  const day = utc ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const today = utc
    ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    : Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((day - today) / 86400000);
}

/** "8/9 are in" — the count phrasing this product uses everywhere. */
export function ratio(part: number, total: number): string {
  return `${part}/${total}`;
}
