import type { SVGProps } from "react";

/**
 * The icon set. Small on purpose: one stroke weight (1.6), round caps, drawn on a
 * 24-unit grid, so every glyph in the product reads as the same hand. Rooms are
 * named in words everywhere there is room for a word; icons only carry the dock and
 * a handful of controls where a word would not fit.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowUpRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Base>
);

export const ArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);

export const Close = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const Plus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const Check = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
);

export const Pulse = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
  </Base>
);

export const Send = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Base>
);

export const Lock = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Base>
);

export const Share = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" />
  </Base>
);

export const Copy = (p: IconProps) => (
  <Base {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </Base>
);

export const Dots = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="18" cy="12" r="1" fill="currentColor" />
  </Base>
);

export const Upload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Base>
);

export const Chevron = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);

/* ---------------------------------------------------------------- room glyphs */

export const RoomGlyph = ({ room, ...p }: IconProps & { room: string }) => {
  switch (room) {
    case "home":
      return (
        <Base {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
        </Base>
      );
    case "tea":
      return (
        <Base {...p}>
          <path d="M5 6h11v5a5.5 5.5 0 0 1-11 0V6Z" />
          <path d="M16 8h1.5a2.5 2.5 0 0 1 0 5H16M6 20h9" />
        </Base>
      );
    case "create":
      return (
        <Base {...p}>
          <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
          <circle cx="12" cy="12" r="2.5" />
        </Base>
      );
    case "one-day":
      return (
        <Base {...p}>
          <path d="M4 7h16v4a2 2 0 0 0 0 4v2H4v-2a2 2 0 0 0 0-4V7Z" />
          <path d="M14 7v10" strokeDasharray="1.5 2" />
        </Base>
      );
    case "align":
      return (
        <Base {...p}>
          <path d="M5 7h9M5 12h14M5 17h6" />
        </Base>
      );
    case "vault":
      return (
        <Base {...p}>
          <rect x="4" y="6" width="13" height="13" rx="1.5" />
          <path d="M8 3h11a1 1 0 0 1 1 1v11" />
          <path d="m4 16 4-4 3 3 2-2 4 4" />
        </Base>
      );
    default:
      return null;
  }
};
