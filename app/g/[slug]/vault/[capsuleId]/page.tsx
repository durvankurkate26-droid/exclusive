import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireGroup, getGroupMembers } from "@/lib/data/session";
import { getCapsule } from "@/lib/data/vault";
import { resolveAvatars } from "@/lib/data/media";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { Avatar } from "@/components/app/Avatar";
import { Gallery, type GalleryItem } from "@/components/vault/Gallery";
import { MediaUploader } from "@/components/vault/MediaUploader";
import {
  CapsuleAdmin,
  DeleteNote,
  NoteComposer,
  ParticipantPicker,
} from "@/components/vault/CapsuleControls";
import { fullDate, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Memory · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.vault;

/**
 * Inside a memory.
 *
 * The page opens the way the night did: the cover photograph full width with the
 * title sitting in it, then who was there, then what people said, then everything
 * that was shot. Reading order is emotional, not administrative — the file list is
 * last, and the upload control is below that, because adding files is maintenance and
 * this page is for looking.
 *
 * The app shell stays exactly where it is. This is the room, not a separate viewer.
 */
export default async function CapsuleDetail({
  params,
}: PageProps<"/g/[slug]/vault/[capsuleId]">) {
  const { slug, capsuleId } = await params;
  const { group, profile, role } = await requireGroup(slug);
  const { capsule, avatars } = await getCapsule(capsuleId, profile.id);

  if (!capsule || capsule.group_id !== group.id) notFound();

  const members = await getGroupMembers(group.id);
  const memberAvatars = await resolveAvatars(members.map((m) => m.profile));

  const galleryItems: GalleryItem[] = capsule.media.map((item) => ({
    id: item.id,
    url: item.url,
    storagePath: item.storage_path,
    caption: item.caption,
    isMine: item.uploaded_by === profile.id,
    isCover: capsule.cover_url === item.storage_path,
  }));

  const canDelete = capsule.created_by === profile.id || role === "owner" || role === "admin";

  return (
    <div className="room room-capsule" style={{ ["--room" as string]: room.accent }}>
      <Link className="thread-back" href={`/g/${slug}/vault`}>
        ← the vault
      </Link>

      {/* ------------------------------------------------------------- the opening */}
      <header className="capsule-hero" data-empty={!capsule.coverUrl}>
        {capsule.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="capsule-hero-image" src={capsule.coverUrl} alt="" />
        )}
        <span className="capsule-hero-scrim" aria-hidden="true" />

        <div className="capsule-hero-text">
          <p className="room-kicker">
            {capsule.memory_date ? fullDate(capsule.memory_date) : "NO DATE ON IT"}
          </p>
          <h1 className="capsule-hero-title">{capsule.title}</h1>
          {capsule.description && (
            <p className="capsule-hero-desc">{capsule.description}</p>
          )}
          <p className="capsule-hero-meta">
            kept by {capsule.author?.display_name ?? "someone"} ·{" "}
            {capsule.media.length}{" "}
            {capsule.media.length === 1 ? "photograph" : "photographs"}
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------------- who was there */}
      <section className="capsule-block">
        <h2 className="section-label">
          {capsule.people.length === 0
            ? "NOBODY'S TAGGED YET"
            : `WHO WAS THERE · ${capsule.people.length}`}
        </h2>
        <ParticipantPicker
          capsuleId={capsule.id}
          slug={slug}
          members={members.map(({ profile: person }) => ({
            id: person.id,
            name: person.display_name,
            url: memberAvatars.get(person.id) ?? null,
          }))}
          taggedIds={capsule.people.map((person) => person.id)}
        />
      </section>

      {/* ------------------------------------------------------------- what was said */}
      <section className="capsule-block">
        <h2 className="section-label">WHAT GOT SAID</h2>

        {capsule.notes.length > 0 && (
          <ul className="quotes">
            {capsule.notes.map((note) => (
              <li key={note.id}>
                <blockquote>
                  “{note.note}”
                  <cite>
                    <Avatar
                      url={avatars.get(note.user_id) ?? null}
                      name={note.author?.display_name ?? "?"}
                      size={22}
                    />
                    {note.author?.display_name ?? "someone"}
                    <span>{timeAgo(note.created_at)}</span>
                  </cite>
                </blockquote>
                {note.user_id === profile.id && (
                  <DeleteNote noteId={note.id} capsuleId={capsule.id} slug={slug} />
                )}
              </li>
            ))}
          </ul>
        )}

        <NoteComposer capsuleId={capsule.id} slug={slug} />
      </section>

      {/* ------------------------------------------------------------- the pictures */}
      <section className="capsule-block">
        <h2 className="section-label">
          {capsule.media.length === 0
            ? "NO PHOTOGRAPHS YET"
            : `THE PHOTOGRAPHS · ${capsule.media.length}`}
        </h2>

        {capsule.media.length === 0 ? (
          <p className="capsule-nothing">
            Somebody has the photos. They always do.
          </p>
        ) : (
          <Gallery items={galleryItems} capsuleId={capsule.id} slug={slug} />
        )}
      </section>

      {/* ------------------------------------------------------------- maintenance */}
      <section className="capsule-block capsule-admin-block">
        <h2 className="section-label">ADD TO THIS MEMORY</h2>
        <MediaUploader capsuleId={capsule.id} groupId={group.id} slug={slug} />
        <CapsuleAdmin
          capsuleId={capsule.id}
          slug={slug}
          title={capsule.title}
          description={capsule.description}
          memoryDate={capsule.memory_date}
          photoCount={capsule.media.length}
          canDelete={canDelete}
        />
      </section>
    </div>
  );
}
