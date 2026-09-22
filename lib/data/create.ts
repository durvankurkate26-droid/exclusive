import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAvatars } from "@/lib/data/media";
import type {
  Attendance,
  CreateIdea,
  CreateRole,
  Profile,
} from "@/lib/supabase/database.types";

/**
 * CREATE's data.
 *
 * A creation is a reference, a description and a crew. The crew is the part that
 * decides whether it happens, so it is never fetched separately from the idea — a
 * wall of things nobody has joined is just a list of links.
 */

export type CrewMember = {
  profile: Profile;
  role: CreateRole | null;
  status: Attendance;
};

export type CreationSummary = CreateIdea & {
  author: Profile | null;
  crew: CrewMember[];
  /** The viewer's own participation, or null if they have not joined. */
  mine: CrewMember | null;
};

export type CreationDetail = CreationSummary & {
  /** The shoot this became, if somebody already scheduled it. */
  planId: string | null;
  /** The memory it was saved as, once it's out. */
  capsuleId: string | null;
};

type CreationRow = CreateIdea & {
  profiles: Profile | null;
  create_members: Array<{ role: string | null; participation_status: string; profiles: Profile | null }>;
};

const CREATION_SELECT = "*, profiles:created_by(*), create_members(role, participation_status, profiles:user_id(*))";

/** The crew is embedded in the creation's own query; this unpacks it. */
function unpack(row: CreationRow, viewerId: string): CreationSummary {
  const { profiles: author, create_members, ...creation } = row;
  const crew: CrewMember[] = (create_members ?? [])
    .filter((m) => m.profiles)
    .map((m) => ({
      profile: m.profiles!,
      role: (m.role as CreateRole | null) ?? null,
      status: m.participation_status as Attendance,
    }));
  return {
    ...(creation as CreateIdea),
    author: author ?? null,
    crew,
    mine: crew.find((member) => member.profile.id === viewerId) ?? null,
  };
}

export async function listCreations(
  groupId: string,
  viewerId: string,
): Promise<{
  live: CreationSummary[];
  shipped: CreationSummary[];
  avatars: Map<string, string | null>;
}> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("create_ideas")
    .select(CREATION_SELECT)
    .eq("group_id", groupId)
    .order("updated_at", { ascending: false });

  const summaries = ((rows ?? []) as unknown as CreationRow[]).map((row) => unpack(row, viewerId));

  const avatars = await resolveAvatars([
    ...summaries.flatMap((s) => s.crew.map((m) => m.profile)),
    ...summaries.map((s) => s.author).filter((a): a is Profile => Boolean(a)),
  ]);

  return {
    live: summaries.filter(
      (creation) => creation.status !== "posted" && creation.status !== "completed",
    ),
    shipped: summaries.filter(
      (creation) => creation.status === "posted" || creation.status === "completed",
    ),
    avatars,
  };
}

export async function getCreation(
  createId: string,
  viewerId: string,
  groupId: string,
): Promise<{ creation: CreationDetail | null; avatars: Map<string, string | null> }> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("create_ideas")
    .select(`${CREATION_SELECT}, plans(id, created_at), memory_capsules(id, created_at)`)
    .eq("id", createId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (!row) return { creation: null, avatars: new Map() };

  const { plans, memory_capsules, ...rest } = row as unknown as CreationRow & {
    plans: Array<{ id: string; created_at: string }>;
    memory_capsules: Array<{ id: string; created_at: string }>;
  };
  const creation = unpack(rest as CreationRow, viewerId);
  const newest = <T extends { created_at: string }>(list: T[] | null | undefined) =>
    [...(list ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return {
    creation: {
      ...creation,
      planId: newest(plans)?.id ?? null,
      capsuleId: newest(memory_capsules)?.id ?? null,
    },
    avatars: await resolveAvatars([
      ...creation.crew.map((m) => m.profile),
      ...(creation.author ? [creation.author] : []),
    ]),
  };
}
