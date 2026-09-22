"use client";

import { useSyncExternalStore } from "react";

/**
 * Hydration-safe reads of per-device state (localStorage).
 *
 * The server has no localStorage, so the first client render must match the server
 * (`null`) and only then show the stored value. `useSyncExternalStore` does exactly
 * that without a setState-in-effect round trip: it renders the server snapshot during
 * hydration and re-renders once with the real one.
 */
const noop = () => () => {};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(noop, () => read(key), () => null);
}

/**
 * The stored value as it was when this page was *arrived at* — frozen, so a write
 * during the visit (TEA saving "seen up to here") doesn't move a divider the reader is
 * looking at. Cleared by `forgetArrival` when the visit ends.
 */
const arrivals = new Map<string, string | null>();

export function useArrivalValue(key: string): string | null {
  return useSyncExternalStore(
    noop,
    () => {
      if (!arrivals.has(key)) arrivals.set(key, read(key));
      return arrivals.get(key) ?? null;
    },
    () => null,
  );
}

export function forgetArrival(key: string) {
  arrivals.delete(key);
}

/** True after hydration; false on the server and during the hydrating render. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
