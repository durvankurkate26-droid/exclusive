"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/session";
import type { Attendance, CreateRole, OptionType } from "@/lib/supabase/database.types";
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

  if (!title) return { error: "What is it? Two words is fine." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("one_day_ideas")
    .insert({
      group_id: groupId,
      created_by: user.id,
      title,
      description: description || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

  // Proposing an option is a vote for it — same reasoning as adding an idea.
  await supabase.from("plan_votes").insert({ option_id: data.id, user_id: user.id });

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
    if (error) return { error: error.message };
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

  if (error) return { error: error.message };

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
  if (!finalDate) return { error: "Pick a date first — that's the whole point." };
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

  if (error) return { error: error.message };

  revalidatePath(`/g/${slug}/align`);
  revalidatePath(`/g/${slug}/align/${planId}`);
  return { message: "It's happening." };
}

export async function unlockPlan(planId: string, slug: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("plans").update({ status: "open" }).eq("id", planId);
  if (error) return { error: error.message };
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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };
  revalidatePath(`/g/${slug}/create/${createId}`);
  return {};
}

/** CREATE -> ALIGN. Same promotion shape as ONE DAY; see the RPC. */
export async function scheduleShoot(createId: string, slug: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promote_create_to_plan", {
    creation: createId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/g/${slug}/create`);
  revalidatePath(`/g/${slug}/align`);
  redirect(`/g/${slug}/align/${data as unknown as string}`);
}
