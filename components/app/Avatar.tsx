/**
 * Member avatar.
 *
 * Falls back to initials on a colour derived from the name, so a group with nobody's
 * photo uploaded still reads as nine distinct people rather than nine grey circles.
 * The hue is a hash of the name, which means it is stable across sessions and devices
 * without storing anything.
 */
export function Avatar({
  url,
  name,
  size = 32,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        ["--avatar-hue" as string]: String(hash),
      }}
      aria-hidden="true"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} loading="lazy" decoding="async" />
      ) : (
        <span className="avatar-initials" style={{ fontSize: Math.round(size * 0.36) }}>
          {initials || "?"}
        </span>
      )}
    </span>
  );
}

/**
 * Overlapping row of faces. Used wherever the answer to "who?" matters more than the
 * count — which, in a product about nine specific people, is almost everywhere.
 */
export function AvatarStack({
  people,
  max = 6,
  size = 30,
}: {
  people: Array<{ id: string; name: string; url: string | null }>;
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <span className="avatar-stack" style={{ ["--stack-size" as string]: `${size}px` }}>
      {shown.map((person, index) => (
        <span
          key={person.id}
          className="avatar-stack-item"
          title={person.name}
          style={{ ["--i" as string]: index }}
        >
          <Avatar url={person.url} name={person.name} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span className="avatar-stack-item avatar-more" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
      <span className="sr-only">{people.map((p) => p.name).join(", ")}</span>
    </span>
  );
}
