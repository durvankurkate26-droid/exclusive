"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  deleteMemoryMedia,
  moveMedia,
  setCapsuleCover,
  setMediaCaption,
} from "@/lib/actions/vault";
import { ArrowLeft, Chevron, Close } from "@/components/app/Icons";
import { toast } from "@/components/app/Toast";

export type GalleryItem = {
  id: string;
  url: string | null;
  storagePath: string;
  caption: string | null;
  isMine: boolean;
  isCover: boolean;
  wide: boolean;
};

/**
 * The photo essay.
 *
 * Not a grid of equal tiles: a repeating editorial rhythm (a wide frame, a tall one
 * beside a small pair, a full-bleed breath) so a capsule reads like a spread in a
 * magazine about your own weekend. Landscape photos are allowed to take the wide
 * slots when they have them. Captions sit under their image, small, like they were
 * written in the margin.
 *
 * Opening a photo expands it into a viewer (native <dialog>, so focus and Escape are
 * handled) where anyone can caption it, make it the cover, or nudge its order, and
 * the uploader can remove it.
 */
const RHYTHM = ["hero", "tall", "sq", "sq", "wide", "sq", "tall", "sq"] as const;

/** Small capsules get their own compositions — a rhythm needs enough beats to read. */
function slotFor(i: number, count: number, wide: boolean): string {
  if (count === 1) return "hero";
  if (count === 2) return "half";
  if (count === 3) return i === 0 ? "hero" : "half";
  if (count === 4) return i === 0 ? "hero" : "third";
  const slot = RHYTHM[i % RHYTHM.length];
  return slot === "wide" && !wide ? "sq" : slot;
}

export function Gallery({
  items,
  capsuleId,
  slug,
}: {
  items: GalleryItem[];
  capsuleId: string;
  slug: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  // The draft belongs to one photo; stepping to another shows that photo's caption.
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = index === null ? null : items[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    if (index === null && dialog.open) dialog.close();
  }, [index]);

  const caption = draft && draft.id === open?.id ? draft.text : (open?.caption ?? "");
  const setCaption = (text: string) => open && setDraft({ id: open.id, text });

  const step = useCallback(
    (delta: number) =>
      setIndex((current) => {
        if (current === null) return null;
        const next = current + delta;
        return next < 0 || next >= items.length ? current : next;
      }),
    [items.length],
  );

  const run = (fn: () => Promise<{ error?: string; message?: string }>, done?: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast(result.error, "error");
      else if (done) toast(done);
    });

  if (items.length === 0) return null;

  return (
    <>
      <div className="essay">
        {items.map((item, i) => {
          const size = slotFor(i, items.length, item.wide);
          return (
            <figure key={item.id} className="essay-frame" data-slot={size} style={{ ["--i" as string]: i }}>
              <button
                type="button"
                className="essay-open"
                onClick={() => setIndex(i)}
                aria-label={item.caption ? `Open photo: ${item.caption}` : `Open photo ${i + 1} of ${items.length}`}
              >
                {item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.caption ?? ""} loading={i < 3 ? "eager" : "lazy"} decoding="async" />
                ) : (
                  <span className="essay-missing">couldn&apos;t load this one</span>
                )}
                {item.isCover && <span className="essay-cover">cover</span>}
              </button>
              {item.caption && <figcaption>{item.caption}</figcaption>}
            </figure>
          );
        })}
      </div>

      <dialog
        ref={dialogRef}
        className="viewer"
        aria-label="Photograph"
        onClose={() => setIndex(null)}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).tagName === "INPUT") return;
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setIndex(null);
        }}
      >
        {open && (
          <>
            <div className="viewer-stage" onClick={(e) => e.target === e.currentTarget && setIndex(null)}>
              {open.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={open.id} src={open.url} alt={open.caption ?? ""} />
              ) : (
                <p className="essay-missing">This one couldn&apos;t load.</p>
              )}
              <button className="viewer-nav viewer-prev" type="button" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous photo">
                <ArrowLeft />
              </button>
              <button className="viewer-nav viewer-next" type="button" onClick={() => step(1)} disabled={index === items.length - 1} aria-label="Next photo">
                <Chevron />
              </button>
            </div>

            <div className="viewer-bar">
              <form
                className="viewer-caption"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(() => setMediaCaption(open.id, capsuleId, slug, caption), "Captioned.");
                }}
              >
                <label className="sr-only" htmlFor="viewer-caption">Caption</label>
                <input
                  id="viewer-caption"
                  className="input"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Say what was happening…"
                  maxLength={200}
                />
                {caption !== (open.caption ?? "") && (
                  <button className="btn btn-sm" type="submit" disabled={pending}>Save</button>
                )}
              </form>

              <div className="viewer-actions">
                <span className="meta">{(index ?? 0) + 1} / {items.length}</span>
                <button className="btn btn-ghost btn-sm" type="button" disabled={pending || index === 0} onClick={() => { run(() => moveMedia(open.id, capsuleId, slug, -1)); step(-1); }}>
                  Earlier
                </button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={pending || index === items.length - 1} onClick={() => { run(() => moveMedia(open.id, capsuleId, slug, 1)); step(1); }}>
                  Later
                </button>
                {!open.isCover && (
                  <button className="btn btn-sm" type="button" disabled={pending} onClick={() => run(() => setCapsuleCover(capsuleId, slug, open.storagePath), "That's the cover now.")}>
                    Make it the cover
                  </button>
                )}
                {open.isMine && (
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Delete this photo for everyone? There's no undo.")) return;
                      run(() => deleteMemoryMedia(open.id, capsuleId, slug), "Deleted.");
                      setIndex(null);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <button className="sheet-close viewer-close" type="button" onClick={() => setIndex(null)} aria-label="Close">
              <Close />
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
