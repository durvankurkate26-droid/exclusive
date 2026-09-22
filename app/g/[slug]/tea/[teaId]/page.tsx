import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { getTea } from "@/lib/data/tea";
import { resolveAvatars } from "@/lib/data/media";
import { ArrowLeft } from "@/components/app/Icons";
import { TeaRoom, type ClientMessage } from "@/components/tea/TeaRoom";
import { TeaStatusControls } from "@/components/tea/SpillTea";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Tea · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * One conversation. A slim sticky header (title, who started it, the status
 * controls), then the conversation owning the page, then the composer pinned to the
 * bottom above the dock.
 */
export default async function TeaThread({ params }: PageProps<"/g/[slug]/tea/[teaId]">) {
  const { slug, teaId } = await params;
  const { group, profile } = await requireGroup(slug);
  const { tea, messages, avatars } = await getTea(teaId);

  if (!tea || tea.group_id !== group.id) notFound();

  const mine = await resolveAvatars([profile]);

  const clientMessages: ClientMessage[] = messages.map((message) => ({
    id: message.id,
    user_id: message.user_id,
    content: message.content,
    created_at: message.created_at,
    author: message.author
      ? { id: message.author.id, name: message.author.display_name, url: avatars.get(message.author.id) ?? null }
      : null,
    reactions: message.reactions,
  }));

  return (
    <div className="tea-thread" data-status={tea.status}>
      <header className="tea-thread-head">
        <Link className="back" href={`/g/${slug}/tea`}>
          <ArrowLeft /> All tea
        </Link>
        <div className="tea-thread-row">
          <div className="tea-thread-text">
            <h1 className="display tea-thread-title">{tea.title}</h1>
            <p className="tea-thread-meta">
              {tea.context && <span className="tea-thread-context">{tea.context} · </span>}
              {tea.author?.display_name ?? "someone"} started this {timeAgo(tea.created_at)}
              {tea.status !== "brewing" && <span className="tea-thread-state"> · {tea.status}</span>}
            </p>
          </div>
          <TeaStatusControls teaId={tea.id} slug={slug} status={tea.status} />
        </div>
      </header>

      <TeaRoom
        teaId={tea.id}
        initialMessages={clientMessages}
        me={{ id: profile.id, name: profile.display_name, url: mine.get(profile.id) ?? null }}
        canPost={tea.status === "brewing"}
      />
    </div>
  );
}
