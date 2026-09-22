"use client";

import Link from "next/link";
import { useState } from "react";
import { Photo } from "@/components/app/Photo";

export type RailItem = {
  id: string;
  title: string;
  date: string;
  cover: string | null;
  href: string;
};

/**
 * Older moments, as a row of narrow spines that open one at a time.
 *
 * Adapted from the 21st.dev "Hover Expand Gallery" (kedhareswer): the open panel's
 * flex-basis animates from rail-width to open-width on a drawer curve, labels run
 * vertically up the spines, and below 900px it becomes an accordion. Rebuilt in the
 * Vault's own material — photographic spines, Bebas titles, mono dates — so it reads
 * like the edges of prints in a box rather than a component.
 *
 * Hover opens on mouse only (a touch "hover" would fire on the way to a tap); focus
 * and tap open it too, and the open panel is a real link into the capsule.
 */
export function OlderRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState(0);

  return (
    <ul className="rail">
      {items.map((item, index) => {
        const open = index === active;
        return (
          <li key={item.id} className="rail-item" data-open={open}>
            <button
              type="button"
              className="rail-spine"
              aria-expanded={open}
              aria-controls={`rail-${item.id}`}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setActive(index);
              }}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
            >
              <span className="rail-title display">{item.title}</span>
              <span className="rail-date meta">{item.date}</span>
            </button>
            <Link id={`rail-${item.id}`} href={item.href} className="rail-print" tabIndex={open ? 0 : -1} aria-hidden={!open}>
              {item.cover ? (
                <Photo src={item.cover} sizes="(max-width: 900px) 100vw, 40vw" />
              ) : (
                <span className="rail-plate" aria-hidden="true">{item.date.split(" ")[0]}</span>
              )}
              <span className="rail-open">Open {item.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
