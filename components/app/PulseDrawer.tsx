"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { loadPulse } from "@/lib/actions/pulse";
import type { ActivityItem } from "@/lib/data/activity";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { timeAgo } from "@/lib/format";
import { Close, Pulse } from "./Icons";

/**
 * "What did I miss?" — one tap from anywhere.
 *
 * A side drawer, not a notification centre: there is nothing to mark as read and no
 * badge count to clear, because this product has no obligation to make you feel
 * behind. It is the group's recent movement, newest first, each line a way in.
 */
export function PulseDrawer({ slug }: { slug: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = () => {
    ref.current?.showModal();
    startTransition(async () => {
      try {
        setItems(await loadPulse(slug));
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });
  };

  const close = () => ref.current?.close();

  return (
    <>
      <button className="pulse-trigger" type="button" onClick={open} aria-label="What's been happening">
        <Pulse />
      </button>
      <dialog
        ref={ref}
        className="drawer"
        aria-label="What's been happening"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <header className="drawer-head">
          <h2 className="display">The pulse</h2>
          <button className="sheet-close" type="button" onClick={close} aria-label="Close">
            <Close />
          </button>
        </header>

        {failed && <p className="form-error">Couldn&apos;t load what&apos;s been happening. Try again in a second.</p>}

        {!items && !failed && (
          <ul className="pulse-list" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="pulse-item">
                <span className="sk" style={{ width: 8, height: 8, borderRadius: 8 }} />
                <span className="sk" style={{ width: `${60 + ((i * 13) % 30)}%`, height: 14 }} />
              </li>
            ))}
          </ul>
        )}

        {items && items.length === 0 && (
          <p className="lede">Nothing in the last three weeks. The group chat is winning.</p>
        )}

        {items && items.length > 0 && (
          <ul className="pulse-list" aria-busy={pending}>
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="pulse-item"
                  onClick={close}
                  style={{ ["--dot" as string]: ROOM_BY_KEY[item.room].accent }}
                >
                  <span className="pulse-dot" aria-hidden="true" />
                  <span className="pulse-text">
                    {item.who && <strong>{item.who} </strong>}
                    {item.text}
                  </span>
                  <time className="meta" dateTime={item.at}>
                    {timeAgo(item.at)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </dialog>
    </>
  );
}
