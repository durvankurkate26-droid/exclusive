"use client";

import { usePathname } from "next/navigation";
import { ROOM_BY_KEY, roomFromPath } from "@/lib/constants/rooms";

/**
 * The light in the room.
 *
 * One fixed wash behind everything, whose colour is the current room's accent. Moving
 * between rooms crossfades the tint rather than swapping a background, which is the
 * same trick the landing page uses to stop section boundaries reading as page
 * changes — here it is what makes route changes feel like walking between rooms of
 * one house rather than loading five different sites.
 *
 * It is a client component purely to read the pathname; it renders two divs and no
 * state, so there is nothing to hydrate beyond that.
 */
export function RoomAtmosphere({ slug }: { slug: string }) {
  const pathname = usePathname();
  const room = ROOM_BY_KEY[roomFromPath(pathname, slug)];

  return (
    <div
      className="app-atmos"
      aria-hidden="true"
      style={{ ["--room" as string]: room.accent }}
    >
      <i className="app-atmos-key" />
      <i className="app-atmos-fill" />
    </div>
  );
}
