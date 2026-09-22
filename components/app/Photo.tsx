import Image from "next/image";

/**
 * A Vault photograph at the size it is shown, not the size it was uploaded.
 *
 * Vault media are private, so `src` is a short-lived signed Storage URL. Routing it
 * through the Next image optimiser means a 90px strip frame downloads ~10KB of AVIF
 * instead of a 1.6MB original, and because signed URLs are now stable for most of
 * their life (see lib/data/media.ts) the optimised result is cached between visits.
 *
 * It fills its parent, so the parent owns the aspect ratio (no layout shift) and must
 * be positioned. `sizes` is required on purpose: without it every photo would be
 * fetched at viewport width.
 */
export function Photo({
  src,
  alt = "",
  sizes,
  priority = false,
  eager = false,
  className,
}: {
  src: string | null;
  alt?: string;
  sizes: string;
  priority?: boolean;
  /** Load now without the preload hint `priority` adds: for images that may sit above the fold. */
  eager?: boolean;
  className?: string;
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : eager ? "eager" : "lazy"}
      className={className}
      style={{ objectFit: "cover" }}
    />
  );
}
