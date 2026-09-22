"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { forgetArrival, useArrivalValue, useHydrated } from "@/lib/client-store";
import { clockTime, dayLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, toggleReaction } from "@/lib/actions/tea";
import { Avatar, AvatarStack } from "@/components/app/Avatar";
import { Send } from "@/components/app/Icons";
import { toast } from "@/components/app/Toast";
import { firstName } from "@/components/app/People";

export type ClientMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: { id: string; name: string; url: string | null } | null;
  reactions: Array<{ reaction: string; userIds: string[] }>;
};

type Me = { id: string; name: string; url: string | null };

/** Five reactions. A limited palette is a voice; a full emoji picker is a keyboard. */
const REACTIONS = ["😭", "💀", "👀", "🔥", "😂"];

/**
 * Stored as an ordinary reaction, so "spilling" a message needs no schema change and
 * rides the same realtime channel and RLS as every other reaction. One tap from any
 * member marks the moment; the UI treats it as a pin, not an emoji.
 */
const SPILL = "☕";

const RUN_GAP = 5 * 60 * 1000;
const SPILL_ECHO = 15 * 60 * 1000;

/**
 * The conversation.
 *
 * Late-night, private, a little dangerous. Not a bubble clone: other people's words
 * are set in one column with their name above each run; yours sit to the right,
 * narrower, lit faintly in magenta. A message somebody "spills" becomes a quoted
 * moment across the full width, and the replies that follow within a few minutes hang
 * off a thin line from it — lightweight threading without a thread UI.
 *
 * Live, over one channel per tea:
 *   postgres_changes  new messages, reactions arriving and leaving
 *   presence          who else has this tea open right now ("3 still awake")
 *   broadcast         typing — ephemeral, never stored
 *
 * Your own messages are optimistic and deduplicated when the real row arrives.
 * "New since you left" is remembered per tea in localStorage — a per-device
 * convenience, deliberately not a read-receipt system.
 */
export function TeaRoom({
  teaId,
  initialMessages,
  me,
  canPost,
  timeZone,
}: {
  teaId: string;
  initialMessages: ClientMessage[];
  me: Me;
  canPost: boolean;
  /** The viewer's zone as the server knows it, so both sides render the same clock. */
  timeZone: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(true);
  const [present, setPresent] = useState<Array<{ id: string; name: string }>>([]);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  // Where you got to last time, frozen at arrival. Null on the server and while
  // hydrating, so the "new since you left" divider can't cause a mismatch.
  const lastSeen = useArrivalValue(`tea-seen:${teaId}`);
  const hydrated = useHydrated();
  const landed = useRef(false);

  const streamRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastTypingSent = useRef(0);
  const knownIds = useRef(new Set(initialMessages.map((m) => m.id)));

  const [optimistic, addOptimistic] = useOptimistic(messages, (current, next: ClientMessage) => [...current, next]);

  // Who we already know, so a live message from someone in the conversation doesn't
  // cost a profile request before it can appear.
  const knownAuthors = useRef(new Map<string, NonNullable<ClientMessage["author"]>>());

  useEffect(() => {
    knownIds.current = new Set(messages.map((m) => m.id));
    for (const m of messages) if (m.author) knownAuthors.current.set(m.user_id, m.author);
  }, [messages]);

  /* ------------------------------------------------------------ realtime */
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const start = async () => {
      // Realtime enforces RLS with the socket's token; a cold socket is anon and
      // silently sees nothing. Attach the session before subscribing.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase.channel(`tea:${teaId}`, { config: { presence: { key: me.id } } });
      channelRef.current = channel;

      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "tea_messages", filter: `tea_id=eq.${teaId}` },
          async (payload) => {
            const row = payload.new as { id: string; user_id: string; content: string; created_at: string };
            let author: ClientMessage["author"] =
              row.user_id === me.id
                ? { id: me.id, name: me.name, url: me.url }
                : (knownAuthors.current.get(row.user_id) ?? null);
            if (!author) {
              // First time this person speaks here: one lookup, then remembered.
              const { data: profile } = await supabase
                .from("profiles")
                .select("id, display_name")
                .eq("id", row.user_id)
                .maybeSingle();
              author = profile ? { id: profile.id, name: profile.display_name, url: null } : null;
            }
            setMessages((current) =>
              current.some((m) => m.id === row.id) ? current : [...current, { ...row, author, reactions: [] }],
            );
            if (row.user_id !== me.id) setFresh((s) => new Set(s).add(row.id));
            setTyping((t) => {
              const next = { ...t };
              delete next[row.user_id];
              return next;
            });
          },
        )
        // Reactions have no tea_id column, so they cannot be filtered server-side.
        // RLS already limits the stream to this group; the handler ignores anything
        // not attached to a message in this conversation.
        .on("postgres_changes", { event: "*", schema: "public", table: "tea_reactions" }, (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as {
            message_id: string;
            user_id: string;
            reaction: string;
          };
          if (!row?.message_id || !knownIds.current.has(row.message_id)) return;
          const add = payload.eventType === "INSERT";
          setMessages((current) =>
            current.map((m) => {
              if (m.id !== row.message_id) return m;
              const existing = m.reactions.find((r) => r.reaction === row.reaction);
              const ids = new Set(existing?.userIds ?? []);
              if (add) ids.add(row.user_id);
              else ids.delete(row.user_id);
              const others = m.reactions.filter((r) => r.reaction !== row.reaction);
              return { ...m, reactions: ids.size ? [...others, { reaction: row.reaction, userIds: [...ids] }] : others };
            }),
          );
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{ id: string; name: string }>();
          const people = Object.values(state)
            .map((entries) => entries[0])
            .filter((p): p is { id: string; name: string; presence_ref: string } => Boolean(p?.id));
          setPresent(people.map(({ id, name }) => ({ id, name })));
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const { id } = payload as { id: string; name: string };
          if (id === me.id) return;
          setTyping((t) => ({ ...t, [id]: Date.now() }));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            setLive(true);
            await channel!.track({ id: me.id, name: me.name });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setLive(false);
          }
        });
    };

    void start();
    return () => {
      cancelled = true;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [teaId, me.id, me.name, me.url]);

  // Typing indicators expire on their own; nobody sends a "stopped typing".
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTyping((t) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(t).filter(([, at]) => now - at < 4000));
        return Object.keys(next).length === Object.keys(t).length ? t : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Remember how far you got, for next time.
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(`tea-seen:${teaId}`, new Date().toISOString());
      } catch {}
    };
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      save();
      forgetArrival(`tea-seen:${teaId}`);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [teaId]);

  /* ------------------------------------------------------------ scroll */
  const firstUnread = useMemo(
    () => (lastSeen ? initialMessages.find((m) => m.created_at > lastSeen && m.user_id !== me.id)?.id : undefined),
    [initialMessages, lastSeen, me.id],
  );

  useEffect(() => {
    // Land on the first unread message if there is one, otherwise at the bottom —
    // once, after hydration, when the stored position is known.
    if (!hydrated || landed.current) return;
    landed.current = true;
    const target = firstUnread ? document.getElementById(`unread-${teaId}`) : null;
    if (target) target.scrollIntoView({ block: "center" });
    else window.scrollTo({ top: document.body.scrollHeight });
  }, [hydrated, firstUnread, teaId]);

  const count = optimistic.length;
  useEffect(() => {
    // Follow new messages only if you were already near the bottom — never yank someone
    // reading back up the conversation.
    const nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 320;
    if (nearBottom) window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, [count]);

  /* ------------------------------------------------------------ actions */
  const submit = () => {
    const content = draft.trim();
    if (!content || pending) return;
    setDraft("");
    startTransition(async () => {
      addOptimistic({
        id: `pending-${Date.now()}`,
        user_id: me.id,
        content,
        created_at: new Date().toISOString(),
        author: me,
        reactions: [],
      });
      const result = await sendMessage(teaId, content);
      if (result.error) {
        toast(result.error, "error");
        setDraft(content);
      }
    });
    window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 30);
  };

  const onType = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 2500) {
      lastTypingSent.current = now;
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { id: me.id, name: me.name } });
    }
  };

  const react = (messageId: string, reaction: string) => {
    if (messageId.startsWith("pending-")) return;
    let removing = false;
    setMessages((current) =>
      current.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find((r) => r.reaction === reaction);
        removing = Boolean(existing?.userIds.includes(me.id));
        const ids = removing ? (existing?.userIds ?? []).filter((id) => id !== me.id) : [...(existing?.userIds ?? []), me.id];
        const others = m.reactions.filter((r) => r.reaction !== reaction);
        return { ...m, reactions: ids.length ? [...others, { reaction, userIds: ids }] : others };
      }),
    );
    void toggleReaction(messageId, reaction).then((result) => {
      if (result.error) toast(result.error, "error");
    });
    if (reaction === SPILL && !removing) toast("Spilled. Everyone will see this one.");
  };

  /* ------------------------------------------------------------ render */
  const others = present.filter((p) => p.id !== me.id);
  const faceOf = (id: string) => optimistic.find((m) => m.user_id === id)?.author?.url ?? null;
  const typers = Object.keys(typing)
    .map((id) => optimistic.find((m) => m.user_id === id)?.author?.name ?? present.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  // Which messages hang off a spill: replies within a few minutes after one. Worked
  // out in one pass up front, so rendering stays a pure map.
  const echoIds = new Set<string>();
  {
    let spillAt: number | null = null;
    for (const message of optimistic) {
      const at = new Date(message.created_at).getTime();
      if (message.reactions.some((r) => r.reaction === SPILL)) spillAt = at;
      else if (spillAt !== null && at - spillAt < SPILL_ECHO) echoIds.add(message.id);
    }
  }

  return (
    <div className="tea-room">
      <div className="tea-stream" ref={streamRef}>
        {optimistic.length === 0 && (
          <p className="tea-nothing">
            Nobody&apos;s said anything yet.
            <span>Someone has to go first.</span>
          </p>
        )}

        {optimistic.map((message, index) => {
          const previous = optimistic[index - 1];
          const at = new Date(message.created_at).getTime();
          const isRun = previous?.user_id === message.user_id && at - new Date(previous.created_at).getTime() < RUN_GAP;
          const isMine = message.user_id === me.id;
          const isPending = message.id.startsWith("pending-");
          const spilled = message.reactions.find((r) => r.reaction === SPILL);
          const reactions = message.reactions.filter((r) => r.reaction !== SPILL);
          const echoes = echoIds.has(message.id);
          const day = dayLabel(message.created_at, timeZone);
          const newDay = !previous || dayLabel(previous.created_at, timeZone) !== day;
          const spillers = spilled
            ? spilled.userIds.map((id) => optimistic.find((m) => m.user_id === id)?.author?.name ?? (id === me.id ? me.name : "someone"))
            : [];

          return (
            <div key={message.id} className="tea-slot">
              {newDay && (
                <p className="tea-day">
                  {day}
                </p>
              )}
              {message.id === firstUnread && (
                <p className="tea-unread" id={`unread-${teaId}`}>
                  <span>new since you left</span>
                </p>
              )}
              <article
                className="tea-message"
                data-run={isRun && !spilled}
                data-mine={isMine}
                data-pending={isPending}
                data-spilled={Boolean(spilled)}
                data-echo={echoes}
                data-fresh={fresh.has(message.id)}
                tabIndex={0}
                aria-label={`${message.author?.name ?? "Someone"}: ${message.content}`}
              >
                {spilled && (
                  <p className="tea-spilled-by">
                    spilled by {spillers.slice(0, 2).map(firstName).join(" & ")}
                    {spillers.length > 2 ? ` +${spillers.length - 2}` : ""}
                  </p>
                )}
                {(!isRun || spilled) && (
                  <header className="tea-message-head">
                    {!isMine && <Avatar url={message.author?.url ?? null} name={message.author?.name ?? "?"} size={28} />}
                    <span className="tea-author">{isMine ? "you" : (message.author?.name ?? "someone")}</span>
                    <time className="tea-time" dateTime={message.created_at}>
                      {clockTime(message.created_at, timeZone)}
                    </time>
                  </header>
                )}

                <p className="tea-text">{message.content}</p>

                {reactions.length > 0 && (
                  <div className="tea-reactions">
                    {reactions.map(({ reaction, userIds }) => (
                      <button
                        key={reaction}
                        className="tea-reaction"
                        type="button"
                        aria-pressed={userIds.includes(me.id)}
                        onClick={() => react(message.id, reaction)}
                        aria-label={`${reaction} ${userIds.length}`}
                      >
                        <span aria-hidden="true">{reaction}</span>
                        <b>{userIds.length}</b>
                      </button>
                    ))}
                  </div>
                )}

                {!isPending && (
                  <div className="tea-tools" role="toolbar" aria-label="React">
                    {REACTIONS.map((reaction) => (
                      <button key={reaction} type="button" onClick={() => react(message.id, reaction)} aria-label={`React ${reaction}`}>
                        {reaction}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="tea-spill-btn"
                      aria-pressed={Boolean(spilled?.userIds.includes(me.id))}
                      onClick={() => react(message.id, SPILL)}
                    >
                      {spilled?.userIds.includes(me.id) ? "Unspill" : "Spill this"}
                    </button>
                  </div>
                )}
              </article>
            </div>
          );
        })}

        {typers.length > 0 && (
          <p className="tea-typing" aria-live="polite">
            <span className="tea-typing-dots" aria-hidden="true"><i /><i /><i /></span>
            {typers.length === 1 ? `${firstName(typers[0])} is typing` : `${typers.map(firstName).join(" and ")} are typing`}
          </p>
        )}
      </div>

      {/* The dock: who's here, and the composer. Pinned to the bottom together, the
          way every chat keeps "online" next to the place you type. */}
      <div className="tea-dock">
        <div className="tea-presence" aria-live="polite">
          {others.length > 0 ? (
            <AvatarStack
              people={others.slice(0, 4).map((p) => ({ id: p.id, name: p.name, url: faceOf(p.id) }))}
              max={4}
              size={22}
            />
          ) : (
            <span className="tea-presence-dot" data-live={live} aria-hidden="true" />
          )}
          {!live
            ? "Reconnecting. New messages will appear when this clears."
            : others.length === 0
              ? "Just you in here right now."
              : `${others.length + 1} still awake: you, ${others.slice(0, 3).map((p) => firstName(p.name)).join(", ")}${others.length > 3 ? " and more" : ""}`}
        </div>
        {canPost ? (
          <form
            className="tea-composer"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="sr-only" htmlFor={`compose-${teaId}`}>Message</label>
            <textarea
              id={`compose-${teaId}`}
              ref={composerRef}
              value={draft}
              onChange={(event) => onType(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line — the convention thumbs already know.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="spill it…"
              rows={1}
              maxLength={2000}
            />
            <button className="tea-send" type="submit" disabled={!draft.trim()} aria-label="Send">
              <Send />
            </button>
          </form>
        ) : (
          <p className="tea-closed">This tea is closed. Reopen it to keep going.</p>
        )}
      </div>
    </div>
  );
}
