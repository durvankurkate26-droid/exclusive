import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { getTea } from "@/lib/data/tea";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { TeaRoom, type ClientMessage } from "@/components/tea/TeaRoom";
import { SpillTea } from "@/components/tea/SpillTea";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Tea · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.tea;

export default async function TeaThread({ params }: PageProps<"/g/[slug]/tea/[teaId]">) {
  const { slug, teaId } = await params;
  const { group, profile } = await requireGroup(slug);
  const { tea, messages, avatars } = await getTea(teaId);

  // A tea in another group is invisible to RLS, so "no row" and "wrong group" are the
  // same outcome here — which is what we want it to look like from outside.
  if (!tea || tea.group_id !== group.id) notFound();

  const clientMessages: ClientMessage[] = messages.map((message) => ({
    id: message.id,
    user_id: message.user_id,
    content: message.content,
    created_at: message.created_at,
    author: message.author
      ? {
          id: message.author.id,
          name: message.author.display_name,
          url: avatars.get(message.author.id) ?? null,
        }
      : null,
    reactions: message.reactions,
  }));

  return (
    <div className="room room-thread" style={{ ["--room" as string]: room.accent }}>
      <header className="thread-head">
        <Link className="thread-back" href={`/g/${slug}/tea`}>
          ← all tea
        </Link>
        <div className="thread-title-row">
          <div>
            <p className="room-kicker">
              TEA · <span>{tea.status}</span>
            </p>
            <h1 className="thread-title">{tea.title}</h1>
            {tea.context && <p className="thread-context">{tea.context}</p>}
            <p className="thread-meta">
              started by {tea.author?.display_name ?? "someone"} ·{" "}
              {timeAgo(tea.created_at)}
            </p>
          </div>
          <SpillTea teaId={tea.id} slug={slug} status={tea.status} />
        </div>
      </header>

      <TeaRoom
        teaId={tea.id}
        initialMessages={clientMessages}
        me={{
          id: profile.id,
          name: profile.display_name,
          url: avatars.get(profile.id) ?? null,
        }}
        canPost={tea.status === "brewing"}
      />
    </div>
  );
}
