import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup, getGroupMembers } from "@/lib/data/session";
import { getCapsule } from "@/lib/data/vault";
import { resolveAvatars } from "@/lib/data/media";
import { Avatar, AvatarStack } from "@/components/app/Avatar";
import { ArrowLeft } from "@/components/app/Icons";
import { firstName, toPeople } from "@/components/app/People";
import { Gallery, type GalleryItem } from "@/components/vault/Gallery";
import { MediaUploader } from "@/components/vault/MediaUploader";
import { CapsuleAdmin, DeleteNote, NoteComposer, ParticipantPicker } from "@/components/vault/CapsuleControls";
import { fullDate, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Memory · EXCLUSIVE" };
export const dynamic = "force-dynamic";

/**
 * A memory capsule — an editorial photo essay about your own weekend.
 *
 * It opens on the cover, full-bleed, with the title set over the photograph and the
 * faces of who was there. Then the best line anybody said, pulled large like a
 * magazine quote. Then the photographs in a varied rhythm with their captions. The
 * machinery (tagging, uploading, editing) is at the end and small, because nobody
 * opens a memory to administrate it.
 */
export default async function CapsuleDetail({ params }: PageProps<"/g/[slug]/vault/[capsuleId]">) {
  const { slug, capsuleId } = await params;
  const { group, profile, role } = await requireGroup(slug);
  const [{ capsule, avatars }, members] = await Promise.all([
    getCapsule(capsuleId, profile.id),
    getGroupMembers(group.id),
  ]);

  if (!capsule || capsule.group_id !== group.id) notFound();

  const memberAvatars = await resolveAvatars(members.map((m) => m.profile));
  const av = new Map([...memberAvatars, ...avatars]);

  const galleryItems: GalleryItem[] = capsule.media.map((item) => ({
    id: item.id,
    url: item.url,
    storagePath: item.storage_path,
    caption: item.caption,
    isMine: item.uploaded_by === profile.id,
    isCover: capsule.cover_url === item.storage_path || (!capsule.cover_url && item === capsule.media[0]),
    wide: Boolean(item.width && item.height && item.width / item.height > 1.25),
  }));

  const canDelete = capsule.created_by === profile.id || role === "owner" || role === "admin";
  const [quote, ...otherNotes] = capsule.notes;
  const fresh = capsule.media.length === 0 && Date.now() - new Date(capsule.created_at).getTime() < 10 * 60 * 1000;
  const date = capsule.memory_date ? new Date(capsule.memory_date) : null;

  return (
    <article className="capsule">
      <Link className="back" href={`/g/${slug}/vault`}>
        <ArrowLeft /> The vault
      </Link>

      {/* -------------------------------------------------------------- the cover */}
      <header className="capsule-hero" data-empty={!capsule.coverUrl}>
        <span className="capsule-hero-image" aria-hidden="true">
          {capsule.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capsule.coverUrl} alt="" fetchPriority="high" decoding="async" />
          ) : (
            <span className="film-leader">
              <b>{date ? date.getDate() : "∞"}</b>
              <i>{date ? date.toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase() : "SOMETIME"}</i>
            </span>
          )}
        </span>
        <div className="capsule-hero-text">
          <p className="meta capsule-date">{capsule.memory_date ? fullDate(capsule.memory_date).toUpperCase() : "NO DATE ON IT"}</p>
          <h1 className="display capsule-title">{capsule.title}</h1>
          {capsule.people.length > 0 && (
            <p className="capsule-people">
              <AvatarStack people={toPeople(capsule.people, av)} max={9} size={32} />
              <span>
                {capsule.people.length === 1
                  ? `${firstName(capsule.people[0].display_name)} was there`
                  : `${capsule.people.slice(0, 2).map((p) => firstName(p.display_name)).join(", ")}${capsule.people.length > 2 ? ` + ${capsule.people.length - 2}` : ""} were there`}
              </span>
            </p>
          )}
        </div>
      </header>

      <div className="capsule-body">
        {capsule.description && <p className="capsule-scene">{capsule.description}</p>}

        {quote && (
          <figure className="capsule-quote">
            <blockquote className="display">“{quote.note}”</blockquote>
            <figcaption>
              <Avatar url={av.get(quote.user_id) ?? null} name={quote.author?.display_name ?? "?"} size={26} />
              {quote.author?.display_name ?? "someone"}
              {quote.user_id === profile.id && <DeleteNote noteId={quote.id} capsuleId={capsule.id} slug={slug} />}
            </figcaption>
          </figure>
        )}

        {/* ------------------------------------------------------------ the essay */}
        <section className="capsule-photos" aria-label="Photographs">
          {capsule.media.length === 0 ? (
            <div className="capsule-waiting">
              <p className="display">{fresh ? "Saved for later-you." : "Somebody has the photos."}</p>
              <p className="lede">{fresh ? "Now put the photos in, before they get buried in the group chat." : "They always do. Get them in here."}</p>
              <MediaUploader capsuleId={capsule.id} groupId={group.id} slug={slug} />
            </div>
          ) : (
            <Gallery items={galleryItems} capsuleId={capsule.id} slug={slug} />
          )}
        </section>

        {/* ------------------------------------------------------------ what got said */}
        <section className="capsule-said" aria-labelledby="said-h">
          <h2 className="section-title" id="said-h">What got said</h2>
          {otherNotes.length > 0 && (
            <ul className="said-list">
              {otherNotes.map((note) => (
                <li key={note.id}>
                  <p>“{note.note}”</p>
                  <span className="said-who">
                    <Avatar url={av.get(note.user_id) ?? null} name={note.author?.display_name ?? "?"} size={20} />
                    {firstName(note.author?.display_name)} · {timeAgo(note.created_at)}
                    {note.user_id === profile.id && <DeleteNote noteId={note.id} capsuleId={capsule.id} slug={slug} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!quote && <p className="lede">Nobody has written down what anyone said. Somebody definitely said something.</p>}
          <NoteComposer capsuleId={capsule.id} slug={slug} />
        </section>

        {/* ------------------------------------------------------------ the back of the box */}
        <footer className="capsule-foot">
          <details className="capsule-tag">
            <summary>
              <span className="display">Who was there?</span>
              <span className="meta">{capsule.people.length} tagged · tap to change</span>
            </summary>
            <ParticipantPicker
              capsuleId={capsule.id}
              slug={slug}
              members={toPeople(members.map((m) => m.profile), av)}
              taggedIds={capsule.people.map((person) => person.id)}
            />
          </details>

          {capsule.media.length > 0 && (
            <div className="capsule-add">
              <MediaUploader capsuleId={capsule.id} groupId={group.id} slug={slug} compact />
            </div>
          )}

          <p className="capsule-kept meta">
            Kept by {capsule.author?.display_name ?? "someone"} · {capsule.media.length} {capsule.media.length === 1 ? "photo" : "photos"}
            <CapsuleAdmin
              capsuleId={capsule.id}
              slug={slug}
              title={capsule.title}
              description={capsule.description}
              memoryDate={capsule.memory_date}
              photoCount={capsule.media.length}
              canDelete={canDelete}
            />
          </p>
        </footer>
      </div>
    </article>
  );
}
