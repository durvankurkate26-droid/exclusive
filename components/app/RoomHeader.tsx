import type { ReactNode } from "react";
import type { Room } from "@/lib/constants/rooms";

/**
 * Every room opens the same way: a mono kicker, the room's name in display type, one
 * line saying what the room is for, and the actions on the right.
 *
 * Consistency here is what stops six pages reading as six products. The only thing
 * that varies is `--room`, which tints the rule under the title.
 */
export function RoomHeader({
  room,
  count,
  children,
}: {
  room: Room;
  count?: string;
  children?: ReactNode;
}) {
  return (
    <header className="room-head" style={{ ["--room" as string]: room.accent }}>
      <div className="room-head-text">
        <p className="room-kicker">
          {room.label}
          {count && <span> · {count}</span>}
        </p>
        <h1 className="room-title">{room.tagline}</h1>
      </div>
      {children && <div className="room-head-actions">{children}</div>}
    </header>
  );
}

/**
 * Empty states carry the product's voice. A room with nothing in it is the first
 * thing most people will see, so "No data" would be the first impression.
 */
export function EmptyState({
  line,
  hint,
  children,
}: {
  line: string;
  hint: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty-line">{line}</p>
      <p className="empty-hint">{hint}</p>
      {children && <div className="empty-action">{children}</div>}
    </div>
  );
}
