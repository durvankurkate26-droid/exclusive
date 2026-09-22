"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ROOM_BY_KEY, roomFromPath } from "@/lib/constants/rooms";

/**
 * The light in the house.
 *
 * `ShellRoot` writes the current room's colour to `--room` on the outermost element,
 * so the nav filament, the group dot, focus rings, the text caret, lit buttons and the
 * ambient wash all change together. Everything transitions its own colour, so moving
 * between rooms reads as the lighting changing rather than a page being swapped.
 */
export function ShellRoot({ slug, children }: { slug: string; children: ReactNode }) {
  const pathname = usePathname();
  const room = roomFromPath(pathname, slug);

  return (
    <div
      className="app-shell"
      data-room={room}
      style={{ ["--room" as string]: ROOM_BY_KEY[room].accent }}
    >
      <div className="app-atmos" aria-hidden="true">
        <i className="app-atmos-key" />
        <i className="app-atmos-fill" />
        <i className="app-atmos-grain" />
      </div>
      {children}
    </div>
  );
}

/**
 * The room-change entrance.
 *
 * Keyed on the pathname so it remounts on every navigation and replays its CSS
 * entrance. The entrance is chosen by room (see `.stage[data-room]` in shell.css) and
 * never delays interaction — content is live from the first frame.
 */
export function RoomStage({ slug, children }: { slug: string; children: ReactNode }) {
  const pathname = usePathname();
  const room = roomFromPath(pathname, slug);
  const base = `/g/${slug}`;
  const depth = pathname.slice(base.length).split("/").filter(Boolean).length;

  return (
    <div key={pathname} className="stage" data-room={room} data-depth={depth > 1 ? "detail" : "room"}>
      {children}
    </div>
  );
}
