"use server";

import { redirect } from "next/navigation";
import { friendly } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/session";
import type {
  Attendance,
  CreateRole,
  CreateStatus,
  OptionType,
} from "@/lib/supabase/database.types";
import type { FormState } from "./profile";

export type { FormState };

/* ===========================================================================
   ONE DAY
   =========================================================================== */

export async function addIdea(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const groupId = String(formData.get("group_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();

  if (!title) return { error: "What is it? Two words is fine." };
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
    return { error: "The picture link needs to start with https://" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("one_day_ideas")
    .insert({
      group_id: groupId,
      created_by: user.id,
      title,
      description: description || null,
      image_url: imageUrl || null,
    })
    .select("id")
    .single();

  if (error) return { error: friendly(error, "rooms") };

  // Putting an idea in is itself a vote for it. Making the author raise their hand
  // separately is a step that exists only because the schema has two tables.
  await supabase
    .from("one_day_interest")
    .insert({ idea_id: data.id, user_id: user.id, interested: true });

  revalidatePath(`/g/${slug}/one-day`);
  return { message: "In." };
}

/** "I'm in" / take it back. Toggles, because people change their minds. */
export async function toggleInterest(ideaId: string, slug: string): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("one_day_interest")
    .select("id, interested")
    .eq("idea_id", ideaId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("one_day_interest")
      .update({ interested: !existing.interested })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("one_day_interest")
      .insert({ idea_id: ideaId, user_id: user.id, interested: true });
  }

  revalidatePath(`/g/${slug}/one-day`);
  return {};
}

/**
 * ONE DAY -> ALIGN.
 *
 * The RPC copies everyone who said "I'm in" onto the new plan as attending, so the
 * hands already raised carry over instead of being asked for twice.
 */
export async function makeThisReal(ideaId: string, slug: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promote_idea_to_plan", { idea: ideaId });

  if (error) return { error: friendly(error, "rooms") };

  revalidatePath(`/g/${slug}/one-day`);
  revalidatePath(`/g/${slug}/align`);
  redirect(`/g/${slug}/align/${data as unknown as string}`);
}

/* ===========================================================================
   ALIGN
   =========================================================================== */

export async function createPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const groupId = String(formData.get("group_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!title) return { error: "Name the thing you're planning." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .insert({ group_id: groupId, created_by: user.id, title })
    .select("id")
    .single();

  if (error) return { error: friendly(error, "rooms") };

  await supabase
    .from("plan_members")
    .insert({ plan_id: data.id, user_id: user.id, attendance_status: "in" });

  revalidatePath(`/g/${slug}/align`);
  redirect(`/g/${slug}/align/${data.id}`);
}

export async function addOption(
  planId: string,
  slug: string,
  optionType: OptionType,
  value: string,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const trimmed = value.trim();
  if (!trimmed) return { error: "Nothing to add." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_options")
    .insert({ plan_id: planId, option_type: optionType, value: trimmed, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: friendly(error, "rooms") };

  // Proposing an option is a vote for it — same reasoning as adding an idea.
  await supabase.from("plan_votes").insert({ option_id: data.id, user_id: user.id });

  revalidatePath(`/g/${slug}/align/${planId}`);
  return {};
}

/** Retract something you proposed. RLS restricts this to the option's author. */
export async function removeOption(
  optionId: string,
  planId: string,
  slug: string,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_options").delete().eq("id", optionId);
  if (error) return { error: friendly(error, "rooms") };
  revalidatePath(`/g/${slug}/align/${planId}`);
  return {};
}

export async function toggleVote(
  optionId: string,
  planId: string,
  slug: string,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("plan_votes")
    .select("id")
    .eq("option_id", optionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("plan_votes").delete().eq("id", existing.id);
  } else {
    const { error } = await supabase
      .from("plan_votes")
      .insert({ option_id: optionId, user_id: user.id });
    if (error) return { error: friendly(error, "rooms") };
  }

  revalidatePath(`/g/${slug}/align/${planId}`);
  return {};
}

export async function setAttendance(
  planId: string,
  slug: string,
  status: Attendance,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_members")
    .upsert(
      { plan_id: planId, user_id: user.id, attendance_status: status },
      { onConflict: "plan_id,user_id" },
    );

  if (error) return { error: friendly(error, "rooms") };

  revalidatePath(`/g/${slug}/align/${planId}`);
  return {};
}

/**
 * Lock the plan.
 *
 * Refuses without a date and a place. A "locked" plan that still says "date: TBD" is
 * the exact ambiguity ALIGN exists to remove, so the button will not let you create
 * one — the winning option for each is passed in from the UI, which is what the
 * group voted for.
 */
export async function lockPlan(
  planId: string,
  slug: string,
  finalDate: string | null,
  finalLocation: string | null,
  finalBudget: string | null,
): Promise<FormState> {
  if (!finalDate) return { error: "Pick a date first. That's the whole point." };
  if (!finalLocation) return { error: "Where, though?" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      status: "locked",
      final_date: finalDate,
      final_location: finalLocation,
      final_budget: finalBudget,
    })
    .eq("id", planId);

  if (error) return { error: friendly(error, "rooms") };

  revalidatePath(`/g/${slug}/align`);
  revalidatePath(`/g/${slug}/align/${planId}`);
  return { message: "It's happening." };
}

export async function unlockPlan(planId: string, slug: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("plans").update({ status: "open" }).eq("id", planId);
  if (error) return { error: friendly(error, "rooms") };
  revalidatePath(`/g/${slug}/align/${planId}`);
  return {};
}

/* ===========================================================================
   CREATE
   =========================================================================== */

export async function addCreation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const groupId = String(formData.get("group_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const referenceUrl = String(formData.get("reference_url") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) return { error: "What are we making?" };
  if (referenceUrl && !/^https?:\/\//i.test(referenceUrl)) {
    return { error: "That link needs to start with http." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("create_ideas")
    .insert({
      group_id: groupId,
      created_by: user.id,
      title,
      description: description || null,
      reference_url: referenceUrl || null,
    })
    .select("id")
    .single();

  if (error) return { error: friendly(error, "rooms") };

  await supabase
    .from("create_members")
    .insert({ create_id: data.id, user_id: user.id, participation_status: "in" });

  revalidatePath(`/g/${slug}/create`);
  return { message: "On the wall." };
}

export async function toggleCreateJoin(
  createId: string,
  slug: string,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("create_members")
    .select("id, participation_status")
    .eq("create_id", createId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.participation_status === "in") {
      await supabase.from("create_members").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("create_members")
        .update({ participation_status: "in" })
        .eq("id", existing.id);
    }
  } else {
    await supabase
      .from("create_members")
      .insert({ create_id: createId, user_id: user.id, participation_status: "in" });
  }

  revalidatePath(`/g/${slug}/create`);
  revalidatePath(`/g/${slug}/create/${createId}`);
  return {};
}

export async function setCreateRole(
  createId: string,
  slug: string,
  role: CreateRole | null,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("create_members")
    .update({ role })
    .eq("create_id", createId)
    .eq("user_id", user.id);

  if (error) return { error: friendly(error, "rooms") };
  revalidatePath(`/g/${slug}/create/${createId}`);
  return {};
}

export async function setCreateStatus(
  createId: string,
  slug: string,
  status: CreateStatus,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("create_ideas")
    .update({ status })
    .eq("id", createId);

  if (error) return { error: friendly(error, "rooms") };

  revalidatePath(`/g/${slug}/create`);
  revalidatePath(`/g/${slug}/create/${createId}`);
  return {};
}

/** CREATE -> ALIGN. Same promotion shape as ONE DAY; see the RPC. */
export async function scheduleShoot(createId: string, slug: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promote_create_to_plan", {
    creation: createId,
  });

  if (error) return { error: friendly(error, "rooms") };

  revalidatePath(`/g/${slug}/create`);
  revalidatePath(`/g/${slug}/align`);
  redirect(`/g/${slug}/align/${data as unknown as string}`);
}

/* ===========================================================================
   ALIGN -> VAULT

   The last edge of the loop the landing page promises. A locked plan that has
   happened becomes a memory capsule seeded with the plan's title, its date and
   everyone who said they were coming — so the people who were there are already
   tagged and nobody has to reconstruct the night from scratch.
   =========================================================================== */

export async function captureToVault(planId: string, slug: string): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Signed out." };

  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, group_id, title, description, final_date")
    .eq("id", planId)
    .maybeSingle();

  if (planError) return { error: planError.message };
  if (!plan) return { error: "That plan is gone." };

  // Already captured: send them to the capsule rather than making a second one.
  const { data: existing } = await supabase
    .from("memory_capsules")
    .select("id")
    .eq("source_plan_id", planId)
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/g/${slug}/vault/${existing.id}`);

  const { data: capsule, error } = await supabase
    .from("memory_capsules")
    .insert({
      group_id: plan.group_id,
      created_by: user.id,
      title: plan.title,
      description: plan.description,
      source_plan_id: plan.id,
      memory_date: plan.final_date ? plan.final_date.slice(0, 10) : null,
    })
    .select("id")
    .single();

  if (error) return { error: friendly(error, "rooms") };

  const { data: attending } = await supabase
    .from("plan_members")
    .select("user_id")
    .eq("plan_id", planId)
    .eq("attendance_status", "in");

  if (attending && attending.length > 0) {
    await supabase.from("memory_members").insert(
      attending.map((row) => ({ capsule_id: capsule.id, user_id: row.user_id })),
    );
  }

  await supabase.from("plans").update({ status: "done" }).eq("id", planId);

  revalidatePath(`/g/${slug}/align`);
  revalidatePath(`/g/${slug}/vault`);
  redirect(`/g/${slug}/vault/${capsule.id}`);
}

/**
 * CREATE's ending: posted, with a link to the finished thing — or simply done, for
 * the shoots that were never meant for the internet. `result_url` arrives with
 * migration 0006; until it runs, posting still works and the link is reported as
 * waiting on the migration rather than failing silently.
 */
export async function finishCreation(
  createId: string,
  slug: string,
  outcome: "posted" | "completed",
  resultUrl: string,
): Promise<FormState> {
  const link = resultUrl.trim();
  if (link && !/^https?:\/\//i.test(link)) return { error: "That link needs to start with http." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("create_ideas")
    .update(link ? { status: outcome, result_url: link } : { status: outcome })
    .eq("id", createId);

  if (error) {
    // PGRST204: the column is not in PostgREST's schema cache — 0006 has not been applied.
    if (error.code === "PGRST204" || /result_url/.test(error.message)) {
      const { error: retry } = await supabase.from("create_ideas").update({ status: outcome }).eq("id", createId);
      if (retry) return { error: retry.message };
      revalidatePath(`/g/${slug}/create`);
      revalidatePath(`/g/${slug}/create/${createId}`);
      return { message: "Marked as done. The link needs migration 0006 (npm run db:push) before it can be saved." };
    }
    return { error: friendly(error, "rooms") };
  }

  revalidatePath(`/g/${slug}/create`);
  revalidatePath(`/g/${slug}/create/${createId}`);
  return { message: "We somehow made it." };
}
