import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup, roomContext } from "@/lib/data/session";
import { listTeas } from "@/lib/data/tea";
import { AvatarStack } from "@/components/app/Avatar";
import { toPeople } from "@/components/app/People";
import { StartTea } from "@/components/tea/StartTea";
import { UnreadDot } from "@/components/tea/Unread";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Tea · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * TEA — the group chat's group chat.
 *
 * The hottest conversation takes the room: its title huge, its last line quoted as if
 * overheard, the faces of whoever's been talking. Everything else still brewing is a
 * quiet list of titles. Spilled and archived teas drop to the bottom, dimmed, like
 * old receipts — kept, not featured.
 */
export default async function TeaPage({ params, searchParams }: PageProps<"/g/[slug]/tea">) {
  const { slug } = await params;
  const { new: wantsNew } = await searchParams;
  const { groupId } = await roomContext(slug);
  const [{ group }, { teas, avatars }] = await Promise.all([requireGroup(slug), listTeas(groupId)]);

  const brewing = teas.filter((t) => t.status === "brewing");
  const done = teas.filter((t) => t.status !== "brewing");
  const [hot, ...others] = brewing;
  const base = `/g/${slug}/tea`;

  return (
    <div className="tea">
      <header className="tea-intro">
        <h1 className="display tea-title">
          Tea<span>.</span>
        </h1>
        <StartTea groupId={group.id} slug={slug} defaultOpen={wantsNew === "1"} />
      </header>

      {teas.length === 0 && (
        <div className="empty">
          <p className="empty-line">Suspiciously peaceful.</p>
          <p className="empty-hint">Nobody has dropped anything. Yet. When someone does, it lives here instead of drowning in the group chat.</p>
        </div>
      )}

      {hot && (
        <Link href={`${base}/${hot.id}`} className="tea-hot">
          <span className="tea-hot-status">
            <i aria-hidden="true" /> brewing · {timeAgo(hot.updated_at)}
            <UnreadDot teaId={hot.id} updatedAt={hot.updated_at} />
          </span>
          <span className="display tea-hot-title">{hot.title}</span>
          {hot.context && <span className="tea-hot-context">{hot.context}</span>}
          {hot.last ? (
            <span className="tea-hot-last">
              <b>{hot.last.author}</b> {hot.last.content}
            </span>
          ) : (
            <span className="tea-hot-last">Nobody&apos;s said anything yet. Go first.</span>
          )}
          <span className="tea-hot-foot">
            {hot.voices.length > 0 && <AvatarStack people={toPeople(hot.voices, avatars)} max={6} size={28} />}
            <span className="meta">{hot.messageCount} messages deep</span>
          </span>
        </Link>
      )}

      {others.length > 0 && (
        <section aria-labelledby="also-h">
          <h2 className="section-title" id="also-h">Also brewing</h2>
          <ul className="tea-list">
            {others.map((tea) => (
              <li key={tea.id}>
                <Link href={`${base}/${tea.id}`} className="tea-row">
                  <span className="display tea-row-title">
                    {tea.title}
                    <UnreadDot teaId={tea.id} updatedAt={tea.updated_at} />
                  </span>
                  {tea.last && (
                    <span className="tea-row-last">
                      <b>{tea.last.author}:</b> {tea.last.content}
                    </span>
                  )}
                  <span className="tea-row-meta">
                    {tea.voices.length > 0 && <AvatarStack people={toPeople(tea.voices, avatars)} max={4} size={22} />}
                    <span className="meta">
                      {tea.messageCount} · {timeAgo(tea.updated_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="tea-old" aria-labelledby="old-h">
          <h2 className="section-title" id="old-h">
            Spilled &amp; shelved <span className="meta">{done.length}</span>
          </h2>
          <ul>
            {done.map((tea) => (
              <li key={tea.id}>
                <Link href={`${base}/${tea.id}`}>
                  <span>{tea.title}</span>
                  <span className="meta">
                    {tea.status} · {tea.messageCount} · {timeAgo(tea.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
