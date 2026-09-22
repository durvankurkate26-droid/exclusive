import { referenceHost } from "@/lib/constants/create";
import { palette, referenceThumb } from "@/lib/art";

/**
 * The reference, as the thing it is. A YouTube link shows its actual frame; anything
 * else becomes a slate, the make's own title chalked on a clapperboard in the
 * creation's colours, with the link's source written where the take note goes. Either way the media, not a
 * card, is what the eye lands on.
 */
export function Reference({
  id,
  url,
  title,
  size = "base",
  titled = true,
}: {
  id: string;
  url: string | null;
  title: string;
  size?: "base" | "large";
  /** Off where the title is already printed beside the frame (the studio wall). */
  titled?: boolean;
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
        // No frame to show: a clapperboard slate with the make written on it, the
        // way a shoot labels a take. The source is the note in the corner.
        <span className="ref-slate" aria-hidden="true">
          <span className="ref-clapper" />
          <span className="ref-slate-title">{titled ? title : (host ?? "No reference yet")}</span>
          <span className="ref-slate-rows">
            <span><i>SOURCE</i>{titled ? (host ?? "in someone's head") : url ? "linked" : "in someone's head"}</span>
            <span><i>TAKE</i>1</span>
          </span>
        </span>
      )}
      <span className="ref-corners" aria-hidden="true" />
    </span>
  );
}
