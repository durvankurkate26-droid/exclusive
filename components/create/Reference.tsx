import { referenceHost } from "@/lib/constants/create";
import { palette, referenceThumb } from "@/lib/art";

/**
 * The reference, as the thing it is. A YouTube link shows its actual frame; anything
 * else becomes a "slip" — the source's name set large on the creation's own colours,
 * like a note pinned up with the link written on it. Either way the media, not a
 * card, is what the eye lands on.
 */
export function Reference({
  id,
  url,
  title,
  size = "base",
}: {
  id: string;
  url: string | null;
  title: string;
  size?: "base" | "large";
}) {
  const thumb = referenceThumb(url);
  const host = referenceHost(url);
  const colors = palette(id);

  return (
    <span
      className="ref"
      data-size={size}
      data-kind={thumb ? "frame" : url ? "slip" : "blank"}
      style={{
        ["--ground" as string]: colors.ground,
        ["--light" as string]: colors.light,
        ["--ink" as string]: colors.ink,
      }}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : (
        <span className="ref-slip" aria-hidden="true">
          <b>{host ?? "no reference yet"}</b>
          <i>{host ? "REFERENCE" : title.slice(0, 1)}</i>
        </span>
      )}
      <span className="ref-corners" aria-hidden="true" />
    </span>
  );
}
