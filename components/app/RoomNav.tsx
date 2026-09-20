"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROOMS, roomFromPath, roomHref } from "@/lib/constants/rooms";

/**
 * The room rail.
 *
 * Carries the landing page's navigation language forward — mono, letterspaced, no
 * chrome — rather than becoming a sidebar, because a left rail of icons is the exact
 * dashboard shape this product is trying not to be.
 *
 * The indicator is one absolutely-positioned element that slides between items rather
 * than a border on each. That is what makes moving between rooms read as one
 * continuous place: the mark travels, so the eye follows it instead of re-finding a
 * new underline. It is measured from the DOM because the labels are different widths
 * and a CSS-only version would need them equal, which would look like a tab bar.
 */
export function RoomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const active = roomFromPath(pathname, slug);
  const listRef = useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const current = list.querySelector<HTMLElement>('[data-active="true"]');
      if (!current) return setIndicator(null);
      setIndicator({ left: current.offsetLeft, width: current.offsetWidth });
    };

    measure();
    // Fonts load after first paint and change every label's width; without this the
    // indicator sits under the wrong room until the next navigation.
    document.fonts?.ready.then(measure).catch(() => {});
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active, slug]);

  return (
    <nav className="room-nav" aria-label="Rooms">
      <ul ref={listRef} className="room-nav-list">
        {indicator && (
          <li
            className="room-nav-indicator"
            aria-hidden="true"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
        {ROOMS.map((room) => {
          const isActive = room.key === active;
          return (
            <li key={room.key}>
              <Link
                href={roomHref(slug, room)}
                data-active={isActive}
                data-room={room.key}
                aria-current={isActive ? "page" : undefined}
                style={{ "--accent": room.accent } as React.CSSProperties}
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
 * Bottom-anchored because the five rooms are the whole product and a hamburger would
 * bury them. Two-letter marks rather than icons: "ONE DAY" and "ALIGN" have no
 * self-evident glyph, and invented ones would need learning.
 */
export function MobileDock({ slug }: { slug: string }) {
  const pathname = usePathname();
  const active = roomFromPath(pathname, slug);

  return (
    <nav className="room-dock" aria-label="Rooms">
      {ROOMS.map((room) => {
        const isActive = room.key === active;
        return (
          <Link
            key={room.key}
            href={roomHref(slug, room)}
            data-active={isActive}
            aria-current={isActive ? "page" : undefined}
            style={{ "--accent": room.accent } as React.CSSProperties}
          >
            <span className="room-dock-mark" aria-hidden="true">
              {room.mark}
            </span>
            <span className="room-dock-label">{room.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
