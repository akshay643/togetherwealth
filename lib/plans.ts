/**
 * Plan/limit helpers. Pure functions over PLAN_META plus a single
 * subscription lookup — safe to use from Server Components and actions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_META, type Plan } from "@/lib/constants";
import type { Database } from "@/lib/types/database";

/**
 * Resolve the effective plan for a workspace from its subscription row.
 * Missing row, lookup error, or a canceled subscription all fall back to
 * "free" so gating never crashes a page.
 */
export async function getWorkspacePlan(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<Plan> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("getWorkspacePlan failed:", error.message);
    return "free";
  }
  if (!data || data.status === "canceled") return "free";
  return data.plan;
}

/** Can this workspace create one more savings goal? */
export function canCreateGoal(plan: Plan, currentCount: number): boolean {
  const limit = PLAN_META[plan].limits.savingsGoals;
  return limit === null || currentCount < limit;
}

/** Can this workspace upload one more document? */
export function canUploadDocument(plan: Plan, currentCount: number): boolean {
  const limit = PLAN_META[plan].limits.documents;
  return limit === null || currentCount < limit;
}

/** Does the plan include monthly money check-ins? */
export function hasCheckins(plan: Plan): boolean {
  return PLAN_META[plan].limits.checkins;
}

/** Does the plan include advanced projections & insights? */
export function hasAdvancedProjections(plan: Plan): boolean {
  return PLAN_META[plan].limits.advancedProjections;
}

/** Does the plan include research hub data export? */
export function hasResearchExport(plan: Plan): boolean {
  return PLAN_META[plan].limits.researchExport;
}
