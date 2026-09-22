import type { Profile } from "@/lib/supabase/database.types";
import { AvatarStack } from "./Avatar";

export type Person = { id: string; name: string; url: string | null };

/** Profiles + the signed-avatar map → the shape every face component takes. */
export function toPeople(
  profiles: Array<Pick<Profile, "id" | "display_name">>,
  avatars: Map<string, string | null>,
): Person[] {
  return profiles.map((p) => ({ id: p.id, name: p.display_name, url: avatars.get(p.id) ?? null }));
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "someone").trim().split(/\s+/)[0];
}

/**
 * "6 / 9" with the faces — the count phrasing this product uses everywhere, because
 * in a group of nine the answer to "who?" matters more than "how many?".
 */
export function Count({
  people,
  total,
  size = 26,
  max = 6,
  label,
}: {
  people: Person[];
  total: number;
  size?: number;
  max?: number;
  label?: string;
}) {
  return (
    <span className="count">
      {people.length > 0 && <AvatarStack people={people} max={max} size={size} />}
      <span className="count-num">
        <b>{people.length}</b>
        <span aria-hidden="true">/</span>
        <span className="sr-only"> of </span>
        {total}
      </span>
      {label && <span className="count-label">{label}</span>}
    </span>
  );
}
