"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Toasts.
 *
 * A module-level queue rather than a context provider: any client component can call
 * `toast()` without being wrapped, and the one <Toaster> in the shell renders them.
 * Wins get personality ("Saved for later-you."); errors stay plain and say what to do.
 */
type Toast = { id: number; content: ReactNode; tone: "ok" | "error"; leaving?: boolean };

let queue: Toast[] = [];
let nextId = 1;
const listeners = new Set<(toasts: Toast[]) => void>();

function emit() {
  for (const listener of listeners) listener(queue);
}

export function toast(content: ReactNode, tone: "ok" | "error" = "ok") {
  const id = nextId++;
  queue = [...queue.slice(-2), { id, content, tone }];
  emit();
  // Errors stay long enough to read twice; wins get out of the way.
  window.setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3200);
}

/**
 * A toast that survives a redirect. Actions like "make this real" end in a server
 * redirect, so the component that pressed the button never sees the result — the
 * message is parked in sessionStorage and shown by the Toaster on the next page.
 */
export function flash(message: string) {
  try {
    sessionStorage.setItem("exclusive:flash", message);
  } catch {}
}

function dismiss(id: number) {
  queue = queue.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  window.setTimeout(() => {
    queue = queue.filter((t) => t.id !== id);
    emit();
  }, 200);
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const parked = sessionStorage.getItem("exclusive:flash");
      if (parked) {
        sessionStorage.removeItem("exclusive:flash");
        toast(parked);
      }
    } catch {}
  }, [pathname]);

  useEffect(() => {
    listeners.add(setToasts);
    setToasts(queue);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast"
          data-tone={t.tone}
          data-leaving={t.leaving ? "true" : undefined}
          role={t.tone === "error" ? "alert" : "status"}
        >
          <span className="toast-mark" aria-hidden="true" />
          <p className="toast-text">{t.content}</p>
        </div>
      ))}
    </div>
  );
}
