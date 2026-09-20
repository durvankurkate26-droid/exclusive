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
};

async function attachCrew(
  creations: CreateIdea[],
  viewerId: string,
): Promise<{ crews: Map<string, CrewMember[]>; profiles: Profile[] }> {
  const crews = new Map<string, CrewMember[]>();
  const profiles: Profile[] = [];
  if (creations.length === 0) return { crews, profiles };

  const supabase = await createClient();
  const { data } = await supabase
    .from("create_members")
    .select("create_id, role, participation_status, profiles:user_id(*)")
    .in(
      "create_id",
      creations.map((creation) => creation.id),
    );

  for (const row of data ?? []) {
    const profile = (row as unknown as { profiles: Profile | null }).profiles;
    if (!profile) continue;
    crews.set(row.create_id, [
      ...(crews.get(row.create_id) ?? []),
      {
        profile,
        role: (row.role as CreateRole | null) ?? null,
        status: row.participation_status as Attendance,
      },
    ]);
    profiles.push(profile);
  }

  void viewerId;
  return { crews, profiles };
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
    .select("*, profiles:created_by(*)")
    .eq("group_id", groupId)
    .order("updated_at", { ascending: false });

  const base = (rows ?? []).map((row) => row as unknown as CreateIdea);
  const { crews, profiles } = await attachCrew(base, viewerId);

  const summaries: CreationSummary[] = (rows ?? []).map((row) => {
    const creation = row as unknown as CreateIdea;
    const crew = crews.get(creation.id) ?? [];
    return {
      ...creation,
      author: (row as unknown as { profiles: Profile | null }).profiles ?? null,
      crew,
      mine: crew.find((member) => member.profile.id === viewerId) ?? null,
    };
  });

  const avatars = await resolveAvatars([
    ...profiles,
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
): Promise<{ creation: CreationDetail | null; avatars: Map<string, string | null> }> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("create_ideas")
    .select("*, profiles:created_by(*)")
    .eq("id", createId)
    .maybeSingle();

  if (!row) return { creation: null, avatars: new Map() };

  const creation = row as unknown as CreateIdea;
  const author = (row as unknown as { profiles: Profile | null }).profiles ?? null;

  const [{ crews, profiles }, { data: plan }] = await Promise.all([
    attachCrew([creation], viewerId),
    supabase
      .from("plans")
      .select("id")
      .eq("source_create_id", creation.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const crew = crews.get(creation.id) ?? [];

  return {
    creation: {
      ...creation,
      author,
      crew,
      mine: crew.find((member) => member.profile.id === viewerId) ?? null,
      planId: plan?.id ?? null,
    },
    avatars: await resolveAvatars([...profiles, ...(author ? [author] : [])]),
  };
}
