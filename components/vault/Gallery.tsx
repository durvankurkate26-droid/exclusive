"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { deleteMemoryMedia, setCapsuleCover } from "@/lib/actions/vault";

export type GalleryItem = {
  id: string;
  url: string | null;
  storagePath: string;
  caption: string | null;
  isMine: boolean;
  isCover: boolean;
};

/**
 * The contact sheet, and the viewer over it.
 *
 * The sheet is deliberately not a uniform grid of squares. Photographs from a night
 * out are a mix of portrait and landscape, and cropping them all to the same tile is
 * what makes a gallery feel like file management — so every fourth frame is given
 * more room and the rest flow around it. The rhythm is index-based, so it is stable
 * between renders rather than reshuffling on every navigation.
 *
 * The viewer is an overlay, not a route. VAULT keeps the app shell — that is the
 * brief's hard requirement — and pushing a full-screen photo route would replace the
 * navigation for as long as somebody is looking at a picture.
 */
export function Gallery({
  items,
  capsuleId,
  slug,
}: {
  items: GalleryItem[];
  capsuleId: string;
  slug: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const close = useCallback(() => setOpenIndex(null), []);

  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) => {
        if (current === null) return null;
        const next = current + delta;
        if (next < 0 || next >= items.length) return current;
        return next;
      }),
    [items.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };

    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while the viewer is up, or dismissing it drops
    // you somewhere other than where you opened it from.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [openIndex, close, step]);

  if (items.length === 0) return null;

  const open = openIndex === null ? null : items[openIndex];

  return (
    <>
      <div className="sheet">
        {items.map((item, index) => (
          <figure key={item.id} className="frame" data-size={index % 5}>
            <button
              type="button"
              className="frame-open"
              onClick={() => setOpenIndex(index)}
              aria-label={item.caption ?? `Photograph ${index + 1}`}
            >
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.caption ?? ""} loading="lazy" decoding="async" />
              ) : (
                <span className="frame-missing">couldn&apos;t load</span>
              )}
            </button>
            {item.isCover && (
              <figcaption className="frame-cover-flag" aria-label="Cover image">
                COVER
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {open && (
        <div
          className="viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Photograph"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="viewer-stage">
            {open.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.url} alt={open.caption ?? ""} />
            ) : (
              <p className="frame-missing">This one couldn&apos;t load.</p>
            )}
          </div>

          <div className="viewer-bar">
            <span className="viewer-count">
              {(openIndex ?? 0) + 1} / {items.length}
            </span>

            <div className="viewer-actions">
              <button
                className="btn"
                type="button"
                onClick={() => step(-1)}
                disabled={openIndex === 0}
              >
                ←
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => step(1)}
                disabled={openIndex === items.length - 1}
              >
                →
              </button>

              {!open.isCover && (
                <button
                  className="btn btn-room"
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await setCapsuleCover(capsuleId, slug, open.storagePath);
                    })
                  }
                >
                  Make this the cover
                </button>
              )}

              {open.isMine && (
                <button
                  className="btn viewer-delete"
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteMemoryMedia(open.id, capsuleId, slug);
                      close();
                    })
                  }
                >
                  Delete
                </button>
              )}

              <button className="btn" type="button" onClick={close}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
