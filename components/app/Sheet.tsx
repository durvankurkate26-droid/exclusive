"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Close } from "./Icons";

/**
 * The one dialog in the product.
 *
 * Built on native <dialog> + showModal(): focus is trapped and restored, Escape
 * closes it, and it renders in the top layer — so no transformed ancestor (the room
 * entrance, a rotated poster) can ever clip or re-parent it. On desktop it grows out
 * of the button that opened it; on phones it rises as a bottom sheet.
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
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  const open = useCallback((event?: React.MouseEvent<HTMLElement>) => {
    const dialog = ref.current;
    if (!dialog) return;
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
  }, []);

  const close = useCallback(() => {
    const dialog = ref.current;
    if (!dialog?.open) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      dialog.close();
      return;
    }
    dialog.dataset.closing = "true";
    window.setTimeout(() => {
      dialog.dataset.closing = "false";
      dialog.close();
    }, 170);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => onClosed?.();
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [onClosed]);

  useEffect(() => {
    if (defaultOpen) open();
  }, [defaultOpen, open]);

  return (
    <>
      {trigger(open)}
      <dialog
        ref={ref}
        className="sheet"
        aria-label={title}
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
            <h2 className="display sheet-title">{title}</h2>
            {intro && <p className="lede">{intro}</p>}
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
