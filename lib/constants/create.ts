import type { CreateRole, CreateStatus } from "@/lib/supabase/database.types";

/**
 * CREATE's vocabulary.
 *
 * Lives in `constants/` rather than beside the queries because the status ladder and
 * the role chips are client components — importing them from `lib/data/create.ts`
 * would drag `server-only` into the browser bundle and fail the build.
 */

/**
 * The pipeline, in order. These statuses are a sequence, not a set of labels, so the
 * UI can draw how far along something is rather than just naming its state.
 * `completed` is deliberately absent: it is an end state, not a rung.
 */
export const CREATE_PIPELINE: CreateStatus[] = [
  "idea",
  "people_joining",
  "scheduled",
  "shot",
  "editing",
  "posted",
];

export const CREATE_STATUS_LABEL: Record<CreateStatus, string> = {
  idea: "just an idea",
  people_joining: "people joining",
  scheduled: "shoot booked",
  shot: "shot it",
  editing: "editing",
  posted: "posted",
  completed: "done",
};

export const CREATE_ROLES: CreateRole[] = ["camera", "director", "editor", "appearing"];

export const CREATE_ROLE_LABEL: Record<CreateRole, string> = {
  camera: "camera",
  director: "directing",
  editor: "editing",
  appearing: "in it",
};

/** "instagram.com" from a full URL — the reference's source, not the tracking query. */
export function referenceHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
