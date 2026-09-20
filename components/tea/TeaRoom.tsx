"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, toggleReaction } from "@/lib/actions/tea";
import { Avatar } from "@/components/app/Avatar";
import { timeAgo } from "@/lib/format";
import type { Profile } from "@/lib/supabase/database.types";

export type ClientMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: { id: string; name: string; url: string | null } | null;
  reactions: Array<{ reaction: string; userIds: string[] }>;
};

const QUICK_REACTIONS = ["🔥", "💀", "😭", "👀", "❤️"];

/**
 * The conversation.
 *
 * Deliberately not a chat-bubble clone. Messages are typographic blocks in one
 * column: the name, the time and the words, with consecutive messages from the same
 * person collapsing into a run. That reads like a transcript of something that
 * mattered rather than a phone screenshot, which is the whole reason TEA exists
 * separately from the group chat it replaces.
 *
 * Three mechanisms keep it live:
 *   optimistic  — your own message appears the instant you hit send
 *   realtime    — everyone else's arrives over a Postgres change subscription
 *   dedupe      — the optimistic copy is replaced when the real row arrives
 */
export function TeaRoom({
  teaId,
  initialMessages,
  me,
  canPost,
}: {
  teaId: string;
  initialMessages: ClientMessage[];
  me: { id: string; name: string; url: string | null };
  canPost: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (current, next: ClientMessage) => [...current, next],
  );

  /**
   * Realtime.
   *
   * One channel, scoped to this tea's rows by the server-side filter — subscribing to
   * the whole table and filtering in the browser would ship every group's messages to
   * every client, which RLS would block but only after they had left the database.
   */
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    /*
     * The socket has to carry the user's token before it subscribes.
     *
     * Realtime enforces RLS using whatever token the *socket* was opened with, not the
     * one the REST calls use. On a cold load the browser client is still hydrating its
     * session from cookies when this effect runs, so subscribing immediately opens the
     * socket as `anon` — which RLS correctly blocks from reading any message. The
     * channel still reports SUBSCRIBED, so it fails completely silently: the
     * conversation simply never updates and nothing anywhere says why.
     *
     * Awaiting the session and calling setAuth first is what makes the subscription
     * actually see rows.
     */
    const start = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`tea:${teaId}`)
        .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tea_messages",
          filter: `tea_id=eq.${teaId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            content: string;
            created_at: string;
          };

          // The payload carries no join, so the author is fetched once per new
          // speaker. Cheap: a conversation has at most nine of them.
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", row.user_id)
            .maybeSingle();

          setMessages((current) => {
            if (current.some((message) => message.id === row.id)) return current;
            return [
              ...current,
              {
                ...row,
                author: profile
                  ? {
                      id: profile.id,
                      name: profile.display_name,
                      // Avatars are signed server-side; a realtime arrival falls back
                      // to initials rather than leaking an unsigned storage path.
                      url: null,
                    }
                  : null,
                reactions: [],
              },
            ];
          });
        },
        )
        .subscribe((status) => {
          // A channel that cannot attach used to fail in total silence. Surfacing it
          // means a dropped connection reads as "reconnecting", not as a conversation
          // where everyone else has mysteriously gone quiet.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setLive(false);
          } else if (status === "SUBSCRIBED") {
            setLive(true);
          }
        });
    };

    void start();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [teaId]);

  // Follow the conversation, but only when it grows.
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [optimistic.length]);

  const submit = () => {
    const content = draft.trim();
    if (!content || pending) return;

    setDraft("");
    setError(null);

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
        setError(result.error);
        // Give the words back rather than losing them.
        setDraft(content);
      }
    });
  };

  const react = (messageId: string, reaction: string) => {
    // Flip locally first; the server is the source of truth on the next render.
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        const existing = message.reactions.find((r) => r.reaction === reaction);
        const mine = existing?.userIds.includes(me.id);
        const others = message.reactions.filter((r) => r.reaction !== reaction);
        const nextIds = mine
          ? (existing?.userIds ?? []).filter((id) => id !== me.id)
          : [...(existing?.userIds ?? []), me.id];
        return {
          ...message,
          reactions: nextIds.length ? [...others, { reaction, userIds: nextIds }] : others,
        };
      }),
    );
    void toggleReaction(messageId, reaction);
  };

  return (
    <div className="tea-room">
      <div className="tea-stream" ref={listRef}>
        {optimistic.length === 0 && (
          <p className="tea-nothing">
            Nobody&apos;s said anything yet. Someone has to go first.
          </p>
        )}

        {optimistic.map((message, index) => {
          const previous = optimistic[index - 1];
          // A run is the same person continuing within five minutes.
          const isRun =
            previous?.user_id === message.user_id &&
            new Date(message.created_at).getTime() -
              new Date(previous.created_at).getTime() <
              5 * 60 * 1000;
          const isMine = message.user_id === me.id;
          const isPending = message.id.startsWith("pending-");

          return (
            <article
              key={message.id}
              className="tea-message"
              data-run={isRun}
              data-mine={isMine}
              data-pending={isPending}
            >
              {!isRun && (
                <header className="tea-message-head">
                  <Avatar
                    url={message.author?.url ?? null}
                    name={message.author?.name ?? "?"}
                    size={26}
                  />
                  <span className="tea-author">{message.author?.name ?? "someone"}</span>
                  <span className="tea-time">{timeAgo(message.created_at)}</span>
                </header>
              )}

              <p className="tea-text">{message.content}</p>

              <div className="tea-message-foot">
                {message.reactions.map(({ reaction, userIds }) => (
                  <button
                    key={reaction}
                    className="tea-reaction"
                    type="button"
                    data-mine={userIds.includes(me.id)}
                    onClick={() => react(message.id, reaction)}
                    aria-label={`${reaction}, ${userIds.length}`}
                  >
                    <span aria-hidden="true">{reaction}</span>
                    <span>{userIds.length}</span>
                  </button>
                ))}

                <div className="tea-react-menu">
                  {QUICK_REACTIONS.map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      onClick={() => react(message.id, reaction)}
                      aria-label={`React ${reaction}`}
                    >
                      {reaction}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {canPost ? (
        <div className="tea-composer">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line — the convention every
              // messaging app shares, and the one people's hands already know.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="spill it…"
            rows={1}
            maxLength={2000}
            aria-label="Message"
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={submit}
            disabled={pending || !draft.trim()}
          >
            Send
          </button>
        </div>
      ) : (
        <p className="tea-closed">This tea has been spilled. Nothing more to add.</p>
      )}

      {!live && (
        <p className="tea-offline" role="status">
          Reconnecting — new messages may not appear until this clears.
        </p>
      )}

      {error && (
        <p className="tea-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
