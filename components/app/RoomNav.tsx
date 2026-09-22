"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { ROOMS, roomFromPath, roomHref, type RoomKey } from "@/lib/constants/rooms";

import { RoomGlyph } from "./Icons";

/** Members and Settings live under the group but are not rooms: no rail item is lit. */
function activeRoom(pathname: string, slug: string): RoomKey | null {
  return /\/(members|settings)(\/|$)/.test(pathname.slice(`/g/${slug}`.length)) ? null : roomFromPath(pathname, slug);
}

/**
 * The room rail.
 *
 * Words in display type, not icons in a sidebar — a left rail of glyphs is the exact
 * dashboard shape this product refuses. Under the active room sits one lit filament
 * that *travels* when you change rooms (measured from the DOM, because the words are
 * different widths), and its colour crossfades to the new room's light on the way.
 * One light moving along a rail is what makes six routes feel like one house.
 */
export function RoomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const active = activeRoom(pathname, slug);
  const listRef = useRef<HTMLUListElement>(null);
  const previous = useRef<string | null>(null);
  const [box, setBox] = useState<{ x: number; w: number; travel: boolean } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    // Only a room change travels. Re-measures (fonts arriving, a resize) snap, or the
    // filament would visibly slide in from a stale position on every page load.
    const travel = previous.current !== null && previous.current !== active;
    previous.current = active;

    const measure = (animate: boolean) => {
      const current = list.querySelector<HTMLElement>('[data-active="true"]');
      if (!current) return setBox(null);
      const x = current.offsetLeft;
      const w = current.offsetWidth;
      // An unchanged re-measure keeps the current state, so it can't cancel a travel.
      setBox((prev) => (prev && prev.x === x && prev.w === w ? prev : { x, w, travel: animate }));
    };

    measure(travel);
    // Bebas arrives after first paint and changes every label's width.
    document.fonts?.ready.then(() => measure(false)).catch(() => {});
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(list);
    return () => observer.disconnect();
  }, [active]);

  return (
    <nav className="room-nav" aria-label="Rooms">
      <ul ref={listRef} className="room-nav-list">
        {box && (
          <li
            className="room-nav-indicator"
            aria-hidden="true"
            data-travel={box.travel}
            style={{ transform: `translateX(${box.x}px)`, width: box.w, left: 0 }}
          />
        )}
        {ROOMS.map((room) => {
          const isActive = room.key === active;
          return (
            <li key={room.key}>
              <Link
                href={roomHref(slug, room)}
                data-active={isActive}
                aria-current={isActive ? "page" : undefined}
              >
                {room.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Mobile dock.
 *
 * Bottom-anchored and always visible, because the six rooms *are* the product and a
 * hamburger would bury them. Glyph plus a short word — the glyph for thumbs that
 * already know where things are, the word for everyone else. The lit pad slides
 * between slots with the same drawer curve as the desktop filament.
 */
export function MobileDock({ slug }: { slug: string }) {
  const pathname = usePathname();
  const active = activeRoom(pathname, slug);
  const index = ROOMS.findIndex((room) => room.key === active);

  return (
    <nav className="room-dock" aria-label="Rooms">
      <span
        className="room-dock-indicator"
        aria-hidden="true"
        data-hidden={index < 0}
        style={{ transform: `translateX(${Math.max(0, index) * 100}%)` }}
      />
      {ROOMS.map((room) => {
        const isActive = room.key === active;
        return (
          <Link
            key={room.key}
            href={roomHref(slug, room)}
            data-active={isActive}
            aria-current={isActive ? "page" : undefined}
            aria-label={room.label}
          >
            <RoomGlyph room={room.key} className="room-dock-glyph" />
            <span className="room-dock-label" aria-hidden="true">
              {room.short}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
