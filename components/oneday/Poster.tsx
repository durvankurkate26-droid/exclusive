import Link from "next/link";
import type { ReactNode } from "react";
import { palette, tilt } from "@/lib/art";

export type PosterFormat = "poster" | "ticket" | "postcard" | "polaroid";

/**
 * A future memory, printed.
 *
 * Every idea on the wall is a physical object — a gig poster, a ticket with a stub,
 * a postcard, a polaroid — with its own colours drawn from the idea's id, so the wall
 * reads as a pinboard of different things rather than a list rendered four ways. The
 * format is chosen by the caller: the idea with the most hands becomes the poster.
 *
 * The object is the link; interactive controls live *outside* it (in `children` of
 * the wrapper), so there is never a button nested inside a link.
 */
export function Poster({
  id,
  href,
  format,
  title,
  description,
  image,
  count,
  total,
  author,
  ready,
  children,
}: {
  id: string;
  href: string;
  format: PosterFormat;
  title: string;
  description: string | null;
  image: string | null;
  count: number;
  total: number;
  author: string;
  ready: boolean;
  children?: ReactNode;
}) {
  const colors = palette(id);
  const style = {
    ["--t" as string]: `${tilt(id, format === "poster" ? 1.2 : 2.4)}deg`,
    ["--ground" as string]: colors.ground,
    ["--light" as string]: colors.light,
    ["--ink" as string]: colors.ink,
  };

  return (
    <article className="idea" data-format={format} data-ready={ready} style={style}>
      <Link href={href} className="idea-object">
        {format === "polaroid" || (image && format === "poster") ? (
          <span className="idea-photo" data-has-image={Boolean(image)}>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <span className="idea-photo-empty" aria-hidden="true">{title.slice(0, 1)}</span>
            )}
          </span>
        ) : null}

        <span className="idea-print">
          {format === "ticket" && <span className="idea-admit">ADMIT {total}</span>}
          <span className="display idea-title">{title}</span>
          {description && format !== "ticket" && <span className="idea-desc">{description}</span>}
          <span className="idea-by">put up by {author}</span>
        </span>

        {format === "ticket" && (
          <span className="idea-stub" aria-hidden="true">
            <b className="display">{count}/{total}</b>
            <span>IN</span>
          </span>
        )}

        {format === "postcard" && (
          <span className="idea-stamp" aria-hidden="true">
            <b className="display">{count}</b>
            <span>of {total}</span>
          </span>
        )}

        {ready && <span className="idea-ready">this might actually happen</span>}
      </Link>
      {children && <div className="idea-controls">{children}</div>}
    </article>
  );
}
