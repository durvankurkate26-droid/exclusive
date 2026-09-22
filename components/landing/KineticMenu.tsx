"use client";

import { useEffect, useRef, useState } from "react";
import { rooms } from "@/lib/constants/landing";
import { menuPreview } from "@/lib/content/group-photos";
import { Shot } from "./Shot";
import { roomElementTarget, roomScrollTarget } from "@/lib/rooms-nav";

type KineticMenuProps = {
  open: boolean;
  onClose: () => void;
};

/** Honour the OS setting: a 4000px programmatic glide is motion too. */
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function KineticMenu({ open, onClose }: KineticMenuProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [activeShape, setActiveShape] = useState(-1);
  // Previews mount on the first open and stay mounted: the menu never pays for five
  // photos unless someone actually opens it, and never pays twice.
  const [seen, setSeen] = useState(false);
  if (open && !seen) setSeen(true);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    focusable?.[0]?.focus();
    // Locking the body is what stops a scrubbed page from scrolling under the panel.
    // `scrollbar-gutter: stable` on <html> is what stops that lock from shifting the
    // fixed navbar sideways by the scrollbar's width every time the menu opens.
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previousFocus?.focus();
    };
  }, [onClose, open]);

  /**
   * Navigate into the pinned five-room story.
   *
   * Every item used to be `href="#modules-anchor"`, which is the *start* of a
   * 4000px pin -- so all five went to TEA. The room states are labelled moments
   * inside that pin, so the target is resolved from the trigger's live scroll range
   * instead (see `lib/rooms-nav`), with the room's own block as the fallback for the
   * stacked mobile build and for reduced motion, where the pin does not exist.
   *
   * The scroll is deferred one frame: `onClose` unlocks `body.overflow` in an effect
   * cleanup, and scrolling while the body is still locked silently does nothing.
   */
  const goToRoom = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    setActiveShape(-1);
    onClose();

    const room = rooms[index];
    requestAnimationFrame(() => {
      const top = roomScrollTarget(room.name) ?? roomElementTarget(index);
      if (top === null) return;
      window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  };

  const goToAnchor = (event: React.MouseEvent, selector: string) => {
    event.preventDefault();
    setActiveShape(-1);
    onClose();
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  };

  return (
    <div id="kinetic-menu" className={open ? "kinetic-menu is-open" : "kinetic-menu"} aria-hidden={!open}>
      <button className="menu-scrim" type="button" onClick={onClose} aria-label="Close menu" tabIndex={open ? 0 : -1} />
      {seen && (
        <div className="menu-preview" aria-hidden="true">
          {menuPreview.map((id, index) => (
            <Shot
              key={id}
              id={id}
              decorative
              eager
              sizes="26vw"
              className="menu-pv"
              data-on={open && activeShape === index ? "" : undefined}
            />
          ))}
        </div>
      )}
      <aside ref={panelRef} className="kinetic-panel" role="dialog" aria-modal="true" aria-label="EXCLUSIVE rooms menu">
        <div className="menu-layer menu-layer-one" />
        <div className="menu-layer menu-layer-two" />
        <div className="menu-layer menu-layer-three" />
        <div className={`menu-shape shape-${activeShape + 1}`} aria-hidden="true" />

        <div className="menu-content">
          <p className="eyebrow menu-kicker">THE ROOMS</p>
          <ul className="menu-list">
            {rooms.map((room, index) => (
              <li key={room.name} style={{ "--item-delay": `${0.34 + index * 0.06}s` } as React.CSSProperties}>
                <a
                  href="#modules-anchor"
                  tabIndex={open ? 0 : -1}
                  data-accent={room.accent}
                  onClick={(event) => goToRoom(event, index)}
                  onMouseEnter={() => setActiveShape(index)}
                  onMouseLeave={() => setActiveShape(-1)}
                  onFocus={() => setActiveShape(index)}
                  onBlur={() => setActiveShape(-1)}
                >
                  <b>{room.number}</b>
                  {room.name}
                </a>
              </li>
            ))}
          </ul>
          <div className="menu-footer">
            <a href="#access" tabIndex={open ? 0 : -1} onClick={(event) => goToAnchor(event, "#access")}>
              GET ACCESS ↗
            </a>
            <span>PRIVATE BY DESIGN</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
