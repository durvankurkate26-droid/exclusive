import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { listCapsules } from "@/lib/data/vault";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { RoomHeader, EmptyState } from "@/components/app/RoomHeader";
import { AvatarStack } from "@/components/app/Avatar";
import { CreateCapsule } from "@/components/vault/CreateCapsule";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Vault · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.vault;

/**
 * VAULT — "don't browse files, enter a memory."
 *
 * Every decision here is an argument against the photo-library default:
 *
 *  - The most recent memory is a full-bleed cinematic band with the cover behind the
 *    type, not a thumbnail in the first grid cell. You are looking *at* a night, not
 *    at a folder that contains it.
 *  - The rest are laid out asymmetrically — spans and vertical offsets vary on a
 *    fixed index rhythm — so the eye moves through them at different speeds. A
 *    uniform grid says "these are files of equal weight"; they are not.
 *  - Each capsule shows a face stack and, when there is one, a fragment of something
 *    somebody said. A date and a filename would be the file-browser reading.
 *  - Layered imagery: the featured band shows the next two photographs behind the
 *    cover, offset, so a memory looks like a stack of prints rather than one flat
 *    image.
 *
 * And it renders inside the ordinary app shell. VAULT is a room in this house.
 */
export default async function VaultPage({ params }: PageProps<"/g/[slug]/vault">) {
  const { slug } = await params;
  const { group } = await requireGroup(slug);
  const { capsules, avatars } = await listCapsules(group.id);

  const [featured, ...rest] = capsules;

  const faces = (people: { id: string; display_name: string }[]) =>
    people.map((person) => ({
      id: person.id,
      name: person.display_name,
      url: avatars.get(person.id) ?? null,
    }));

  return (
    <div className="room room-vault" style={{ ["--room" as string]: room.accent }}>
      <RoomHeader
        room={room}
        count={capsules.length ? `${capsules.length} KEPT` : undefined}
      >
        <CreateCapsule groupId={group.id} slug={slug} />
      </RoomHeader>

      {capsules.length === 0 ? (
        <EmptyState line={room.empty.line} hint={room.empty.hint}>
          <CreateCapsule groupId={group.id} slug={slug} />
        </EmptyState>
      ) : (
        <>
          {/* ------------------------------------------------- the featured memory */}
          {featured && (
            <Link
              href={`/g/${slug}/vault/${featured.id}`}
              className="feature"
              data-empty={!featured.coverUrl}
            >
              <div className="feature-stack" aria-hidden="true">
                {/* Layered prints: the cover in front, the next two behind it. */}
                {featured.previews.slice(1, 3).map((preview, index) =>
                  preview.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={preview.id}
                      className="feature-layer"
                      data-layer={index}
                      src={preview.url}
                      alt=""
                    />
                  ) : null,
                )}
                {featured.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="feature-cover" src={featured.coverUrl} alt="" />
                )}
                <span className="feature-scrim" />
              </div>

              <div className="feature-text">
                <p className="feature-kicker">
                  THE LAST ONE
                  {featured.memory_date && <span> · {shortDate(featured.memory_date)}</span>}
                </p>
                <h2 className="feature-title">{featured.title}</h2>

                {featured.fragment ? (
                  <blockquote className="feature-quote">
                    “{featured.fragment.note}”
                    <cite>
                      {featured.fragment.author?.display_name ?? "someone"}
                    </cite>
                  </blockquote>
                ) : (
                  featured.description && (
                    <p className="feature-desc">{featured.description}</p>
                  )
                )}

                <div className="feature-foot">
                  {featured.people.length > 0 && (
                    <AvatarStack people={faces(featured.people)} max={7} size={32} />
                  )}
                  <span>
                    {featured.mediaCount}{" "}
                    {featured.mediaCount === 1 ? "photograph" : "photographs"}
                  </span>
                  <span className="feature-enter">Enter ↗</span>
                </div>
              </div>
            </Link>
          )}

          {/* ------------------------------------------------- everything before it */}
          {rest.length > 0 && (
            <section className="wall-section">
              <h2 className="section-label">EVERYTHING ELSE WE KEPT</h2>

              <div className="capsules">
                {rest.map((capsule, index) => (
                  <Link
                    key={capsule.id}
                    href={`/g/${slug}/vault/${capsule.id}`}
                    className="capsule"
                    /* Five-step rhythm: sizes and offsets repeat, but not on any
                       boundary the eye can lock onto as a grid. */
                    data-shape={index % 5}
                  >
                    <div className="capsule-image">
                      {capsule.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={capsule.coverUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="capsule-blank">
                          {capsule.title.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="capsule-scrim" aria-hidden="true" />
                    </div>

                    <div className="capsule-text">
                      {capsule.memory_date && (
                        <p className="capsule-date">{shortDate(capsule.memory_date)}</p>
                      )}
                      <h3 className="capsule-title">{capsule.title}</h3>
                      {capsule.fragment && (
                        <p className="capsule-fragment">“{capsule.fragment.note}”</p>
                      )}
                      <div className="capsule-foot">
                        {capsule.people.length > 0 && (
                          <AvatarStack people={faces(capsule.people)} max={4} size={22} />
                        )}
                        <span>{capsule.mediaCount}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
