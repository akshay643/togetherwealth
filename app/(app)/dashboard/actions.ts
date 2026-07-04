"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity, notifyPartner } from "@/lib/activity";
import { ROUTES } from "@/lib/constants";
import { requireWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";

const completeTaskSchema = z.object({
  taskId: z.uuid(),
});

export type CompleteTaskResult = { error: string } | { success: true };

/**
 * Mark one of the current user's tasks as done. Logs an activity event and,
 * when the task was created by the partner, notifies them.
 */
export async function completeTask(input: {
  taskId: string;
}): Promise<CompleteTaskResult> {
  const parsed = completeTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "That task couldn't be identified. Please try again." };
  }

  const ctx = await requireWorkspace();
  const supabase = await createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", parsed.data.taskId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (fetchError || !task) {
    return { error: "That task couldn't be found." };
  }
  if (task.status === "done") {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", task.id);

  if (updateError) {
    return { error: "The task couldn't be completed. Please try again." };
  }

  const actorName = ctx.profile.full_name?.split(/\s+/)[0] ?? "Your partner";
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "task.completed",
    summary: `${actorName} completed the task "${task.title}"`,
    entityType: "task",
    entityId: task.id,
    visibility: "shared",
  });

  if (task.created_by !== ctx.user.id) {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "task.completed",
      title: `${actorName} completed "${task.title}"`,
      link: ROUTES.tasks,
    });
  }

  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.tasks);
  return { success: true };
}
