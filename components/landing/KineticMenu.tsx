"use client";

import { useEffect, useRef, useState } from "react";
import { rooms } from "@/lib/constants/landing";

type KineticMenuProps = {
  open: boolean;
  onClose: () => void;
};

export function KineticMenu({ open, onClose }: KineticMenuProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [activeShape, setActiveShape] = useState(-1);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    focusable?.[0]?.focus();
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

  const navigate = () => {
    setActiveShape(-1);
    onClose();
  };

  return (
    <div id="kinetic-menu" className={open ? "kinetic-menu is-open" : "kinetic-menu"} aria-hidden={!open}>
      <button className="menu-scrim" type="button" onClick={onClose} aria-label="Close menu" tabIndex={open ? 0 : -1} />
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
                  onClick={navigate}
                  onMouseEnter={() => setActiveShape(index)}
                  onMouseLeave={() => setActiveShape(-1)}
                  onFocus={() => setActiveShape(index)}
                  onBlur={() => setActiveShape(-1)}
                >
                  {room.name}
                </a>
              </li>
            ))}
          </ul>
          <div className="menu-footer">
            <a href="#access" tabIndex={open ? 0 : -1} onClick={navigate}>REQUEST ACCESS ↗</a>
            <span>INVITE-ONLY</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
