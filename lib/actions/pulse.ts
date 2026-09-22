"use server";

import { requireGroup } from "@/lib/data/session";
import { getActivity, type ActivityItem } from "@/lib/data/activity";

/**
 * The pulse drawer loads on open rather than with the layout: the shell persists
 * across navigations, so fetching it there would be ten queries nobody asked for on
 * every cold load. `requireGroup` proves membership before anything is read.
 */
export async function loadPulse(slug: string): Promise<ActivityItem[]> {
  const { group } = await requireGroup(slug);
  return getActivity(group.id, slug, 30);
}
