"use client";

import Image from "next/image";
import type { CSSProperties, HTMLAttributes } from "react";
import { photos, type PhotoId } from "@/lib/content/group-photos";

type ShotProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  id: PhotoId;
  /** `sizes` for next/image. Every placement knows its own rendered width. */
  sizes: string;
  /** Decorative placements (trail, atmosphere) pass true and get an empty alt. */
  decorative?: boolean;
  /** Above-the-fold only. Everything else stays lazy. */
  eager?: boolean;
  /** Keep the frame's own aspect ratio; false when the parent sizes the frame. */
  ratio?: boolean;
  style?: CSSProperties;
};

/**
 * One photograph, one treatment.
 *
 * The frame (`.shot`) owns crop, radius and the photographic finish (a slightly deeper
 * black point and a grain layer); the image only fills it. The image arrives
 * blurred and a touch underexposed and settles when it has actually decoded, so a
 * photo never pops in at full brightness mid-scroll. That settle is keyed off the real
 * load event, not a timer.
 */
export function Shot({
  id,
  sizes,
  decorative = false,
  eager = false,
  ratio = true,
  className = "",
  style,
  ...rest
}: ShotProps) {
  const p = photos[id];
  return (
    <figure
      className={`shot ${className}`}
      style={ratio ? { aspectRatio: `${p.w} / ${p.h}`, ...style } : style}
      {...rest}
    >
      <Image
        src={p.src}
        alt={decorative ? "" : p.alt}
        fill
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        // A photo can finish loading before hydration attaches onLoad (cached, or
        // simply fast), so the ref checks `complete` as well.
        ref={(img) => {
          if (img?.complete && img.naturalWidth) img.dataset.ok = "";
        }}
        onLoad={(event) => {
          event.currentTarget.dataset.ok = "";
        }}
      />
    </figure>
  );
}
