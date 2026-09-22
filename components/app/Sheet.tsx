"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Close } from "./Icons";

/**
 * The one dialog in the product.
 *
 * Built on native <dialog> + showModal(): focus is trapped and restored, Escape
 * closes it, and it renders in the top layer — so no transformed ancestor (the room
 * entrance, a rotated poster) can ever clip or re-parent it. On desktop it grows out
 * of the button that opened it; on phones it rises as a bottom sheet. The page behind
 * stops scrolling while it is open (`:has(dialog[open])` in shell.css).
 *
 * Because it contains a heading, a Sheet must never be rendered inside a <p> (or any
 * phrasing-only parent): the browser would split the paragraph and hydration fails.
 *
 * `trigger` is rendered as-is and handed an `open` callback, so each room keeps its
 * own button language rather than every create-flow sharing one generic button.
 */
export function Sheet({
  title,
  intro,
  trigger,
  children,
  defaultOpen = false,
  onClosed,
}: {
  title: string;
  intro?: ReactNode;
  trigger: (open: (event?: React.MouseEvent<HTMLElement>) => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  defaultOpen?: boolean;
  onClosed?: () => void;
}) {
  // The element lives in state (via a callback ref) rather than a ref object, so the
  // handlers handed to `trigger` during render never read a ref.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  // Contents mount on first open, not with the page — a room with four sheets should
  // not hydrate four forms nobody opened. A deep-linked sheet mounts immediately.
  const [mounted, setMounted] = useState(defaultOpen);
  const titleId = useId();
  const introId = useId();

  const open = useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      if (!dialog || dialog.open) return;
      // Grow from the trigger: offset the entrance by the vector from the viewport
      // centre to the button, scaled down so it reads as "came from there", not a fly-in.
      if (event && window.matchMedia("(min-width: 641px)").matches) {
        const rect = event.currentTarget.getBoundingClientRect();
        const dx = (rect.left + rect.width / 2 - window.innerWidth / 2) * 0.25;
        const dy = (rect.top + rect.height / 2 - window.innerHeight / 2) * 0.25;
        dialog.style.setProperty("--from-x", `${Math.round(dx)}px`);
        dialog.style.setProperty("--from-y", `${Math.round(dy)}px`);
      } else {
        dialog.style.removeProperty("--from-x");
        dialog.style.removeProperty("--from-y");
      }
      setMounted(true);
      dialog.showModal();
    },
    [dialog],
  );

  const close = useCallback(() => {
    if (!dialog?.open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      return;
    }
    dialog.setAttribute("data-closing", "true");
    window.setTimeout(() => {
      dialog.setAttribute("data-closing", "false");
      dialog.close();
    }, 170);
  }, [dialog]);

  useEffect(() => {
    if (!dialog || !onClosed) return;
    dialog.addEventListener("close", onClosed);
    return () => dialog.removeEventListener("close", onClosed);
  }, [dialog, onClosed]);

  // `?new=1` deep links (Home's quick actions) arrive with the sheet already open.
  useEffect(() => {
    if (defaultOpen && dialog && !dialog.open) dialog.showModal();
  }, [defaultOpen, dialog]);

  return (
    <>
      {trigger(open)}
      <dialog
        ref={setDialog}
        className="sheet"
        aria-labelledby={titleId}
        aria-describedby={intro ? introId : undefined}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <div className="sheet-body">
          <header className="sheet-head">
            <h2 className="display sheet-title" id={titleId}>
              {title}
            </h2>
            {intro && (
              <p className="lede" id={introId}>
                {intro}
              </p>
            )}
          </header>
          {mounted && children(close)}
        </div>
        <button className="sheet-close" type="button" onClick={close} aria-label="Close">
          <Close />
        </button>
      </dialog>
    </>
  );
}
