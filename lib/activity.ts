/**
 * Server-side collaboration helpers: activity feed + partner notifications.
 *
 * These are intentionally fire-and-forget — they log failures to the console
 * and never throw, so an audit-trail hiccup can never break the mutation
 * that called them. Call them from Server Actions after the main write
 * succeeds.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Visibility } from "@/lib/constants";
import type { Database, Json } from "@/lib/types/database";

export interface LogActivityParams {
  workspaceId: string;
  actorId: string;
  /** e.g. "expense.created", "goal.completed" */
  eventType: string;
  /** Human-readable summary, e.g. "Alex added expense Groceries $82" */
  summary: string;
  entityType?: string;
  entityId?: string;
  /** Mirror the visibility of the underlying item. Defaults to "shared". */
  visibility?: Visibility;
  metadata?: Json;
}

/** Insert an activity_events row. Swallows errors (console.error only). */
export async function logActivity(
  supabase: SupabaseClient<Database>,
  params: LogActivityParams
): Promise<void> {
  try {
    const { error } = await supabase.from("activity_events").insert({
      workspace_id: params.workspaceId,
      actor_id: params.actorId,
      event_type: params.eventType,
      summary: params.summary,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      visibility: params.visibility ?? "shared",
      metadata: params.metadata ?? {},
    });
    if (error) console.error("logActivity failed:", error.message);
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}

export interface NotifyPartnerParams {
  workspaceId: string;
  /** The user who acted — everyone in the workspace EXCEPT them is notified. */
  actorId: string;
  /** e.g. "approval.requested", "comment.added", "reminder.document" */
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Notify the other member(s) of a workspace. Looks up workspace_members,
 * excludes the actor, and inserts one notifications row per partner.
 * Swallows errors (console.error only).
 */
export async function notifyPartner(
  supabase: SupabaseClient<Database>,
  params: NotifyPartnerParams
): Promise<void> {
  try {
    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", params.workspaceId)
      .neq("user_id", params.actorId);

    if (error) {
      console.error("notifyPartner lookup failed:", error.message);
      return;
    }
    if (!members || members.length === 0) return;

    const { error: insertError } = await supabase.from("notifications").insert(
      members.map((member) => ({
        user_id: member.user_id,
        workspace_id: params.workspaceId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
      }))
    );
    if (insertError) {
      console.error("notifyPartner insert failed:", insertError.message);
    }
  } catch (err) {
    console.error("notifyPartner failed:", err);
  }
}
