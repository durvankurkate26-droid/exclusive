import Link from "next/link";
import type { Metadata } from "next";
import { requireGroup } from "@/lib/data/session";
import { listTeas } from "@/lib/data/tea";
import { ROOM_BY_KEY } from "@/lib/constants/rooms";
import { RoomHeader, EmptyState } from "@/components/app/RoomHeader";
import { AvatarStack } from "@/components/app/Avatar";
import { StartTea } from "@/components/tea/StartTea";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Tea · EXCLUSIVE" };
export const dynamic = "force-dynamic";

const room = ROOM_BY_KEY.tea;

export default async function TeaPage({ params }: PageProps<"/g/[slug]/tea">) {
  const { slug } = await params;
  const { group } = await requireGroup(slug);
  const { teas, avatars } = await listTeas(group.id);

  const brewing = teas.filter((tea) => tea.status === "brewing");
  const settled = teas.filter((tea) => tea.status !== "brewing");

  return (
    <div className="room" style={{ ["--room" as string]: room.accent }}>
      <RoomHeader room={room} count={teas.length ? `${teas.length}` : undefined}>
        <StartTea groupId={group.id} slug={slug} />
      </RoomHeader>

      {teas.length === 0 ? (
        <EmptyState line={room.empty.line} hint={room.empty.hint} />
      ) : (
        <div className="tea-list">
          {brewing.length > 0 && (
            <section>
              <h2 className="section-label">STILL BREWING</h2>
              <ul className="tea-cards">
                {brewing.map((tea) => (
                  <li key={tea.id}>
                    <Link href={`/g/${slug}/tea/${tea.id}`} className="tea-card">
                      <span className="tea-card-status" data-status="brewing">
                        brewing
                      </span>
                      <h3>{tea.title}</h3>
                      {tea.context && <p className="tea-card-context">{tea.context}</p>}
                      <div className="tea-card-foot">
                        <AvatarStack
                          people={tea.voices.map((p) => ({
                            id: p.id,
                            name: p.display_name,
                            url: avatars.get(p.id) ?? null,
                          }))}
                          max={5}
                          size={24}
                        />
                        <span>
                          {tea.messageCount === 0
                            ? "no replies yet"
                            : `${tea.messageCount} ${tea.messageCount === 1 ? "message" : "messages"}`}{" "}
                          · {timeAgo(tea.updated_at)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {settled.length > 0 && (
            <section>
              <h2 className="section-label">ALREADY SPILLED</h2>
              <ul className="tea-cards is-quiet">
                {settled.map((tea) => (
                  <li key={tea.id}>
                    <Link href={`/g/${slug}/tea/${tea.id}`} className="tea-card">
                      <span className="tea-card-status" data-status={tea.status}>
                        {tea.status}
                      </span>
                      <h3>{tea.title}</h3>
                      <div className="tea-card-foot">
                        <span>
                          {tea.messageCount} messages · {timeAgo(tea.updated_at)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
