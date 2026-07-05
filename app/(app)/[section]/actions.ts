"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity, notifyPartner } from "@/lib/activity";
import {
  DEBT_TYPES,
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES,
  GOAL_TYPES,
  RECURRENCE_FREQUENCIES,
  ROUTES,
  VISIBILITY_LEVELS,
} from "@/lib/constants";
import { requireWorkspace } from "@/lib/data/workspace";
import { canCreateGoal } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { success: true };

const dollars = z
  .number()
  .finite()
  .positive("Enter an amount greater than zero")
  .max(100_000_000);

const optionalDollars = z.number().finite().min(0).max(100_000_000);

const shortText = (message: string) =>
  z.string().trim().min(1, message).max(100, "Keep it under 100 characters");

const optionalNotes = z
  .string()
  .trim()
  .max(500, "Keep notes under 500 characters")
  .optional();

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Choose a month")
  .transform((month) => `${month}-01`);

const expenseSchema = z.object({
  description: shortText("Name this expense"),
  amount: dollars,
  category: z.enum(EXPENSE_CATEGORIES),
  expenseDate: z.iso.date("Choose a valid date"),
  expenseType: z.enum(EXPENSE_TYPES),
  visibility: z.enum(VISIBILITY_LEVELS),
  isRecurring: z.boolean(),
  recurrence: z.enum(RECURRENCE_FREQUENCIES).optional(),
  merchant: z.string().trim().max(100, "Keep it under 100 characters").optional(),
  notes: optionalNotes,
});

const budgetSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: dollars,
  month: monthSchema,
  scope: z.enum(["household", "personal"]),
  visibility: z.enum(VISIBILITY_LEVELS),
  rollover: z.boolean(),
});

const debtSchema = z.object({
  name: shortText("Name this debt"),
  debtType: z.enum(DEBT_TYPES),
  balance: dollars,
  apr: z.number().finite().min(0).max(100),
  minimumPayment: optionalDollars,
  dueDay: z.number().int().min(1).max(31).nullable(),
  visibility: z.enum(VISIBILITY_LEVELS),
  notes: optionalNotes,
});

const goalSchema = z.object({
  name: shortText("Name this goal"),
  goalType: z.enum(GOAL_TYPES),
  targetAmount: dollars,
  targetDate: z.iso.date("Choose a valid date").optional().or(z.literal("")),
  monthlyContribution: optionalDollars,
  visibility: z.enum(VISIBILITY_LEVELS),
  emoji: z.string().trim().max(8, "Keep it short").optional(),
  notes: optionalNotes,
});

function actorName(fullName: string | null, email: string): string {
  return fullName?.trim() || email || "Your partner";
}

async function refreshMoneyPages() {
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.netWorth);
  revalidatePath(ROUTES.cashFlow);
  revalidatePath(ROUTES.expenses);
  revalidatePath(ROUTES.budgets);
  revalidatePath(ROUTES.debts);
  revalidatePath(ROUTES.goals);
  revalidatePath(ROUTES.coupleGoals);
  revalidatePath(ROUTES.emergencyFund);
  revalidatePath(ROUTES.activity);
}

export async function createExpenseAction(
  input: z.input<typeof expenseSchema>
): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the expense details." };
  }

  const ctx = await requireWorkspace();
  const supabase = await createClient();
  const data = parsed.data;
  const expenseType = data.visibility === "private" ? "personal" : data.expenseType;
  const recurrence = data.isRecurring ? data.recurrence ?? "monthly" : null;

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      paid_by: ctx.user.id,
      description: data.description,
      amount: data.amount,
      category: data.category,
      expense_date: data.expenseDate,
      expense_type: expenseType,
      visibility: data.visibility,
      is_recurring: data.isRecurring,
      recurrence,
      split_method: "none",
      merchant: data.merchant?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !expense) {
    return { error: "The expense could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "expense.created",
    entityType: "expense",
    entityId: expense.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You added a private expense: ${data.description}`
        : `${name} added an expense: ${data.description}`,
  });
  if (data.visibility !== "private") {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "expense.created",
      title: `${name} added an expense`,
      body: data.description,
      link: ROUTES.expenses,
    });
  }

  await refreshMoneyPages();
  return { success: true };
}

export async function createBudgetAction(
  input: z.input<typeof budgetSchema>
): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the budget details." };
  }

  const ctx = await requireWorkspace();
  const supabase = await createClient();
  const data = parsed.data;
  const isHousehold = data.scope === "household";
  const visibility = isHousehold ? "household" : data.visibility;

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({
      workspace_id: ctx.workspace.id,
      owner_id: isHousehold ? null : ctx.user.id,
      category: data.category,
      amount: data.amount,
      month: data.month,
      scope: data.scope,
      visibility,
      rollover: data.rollover,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    return { error: "That budget already exists for this month." };
  }
  if (error || !budget) {
    return { error: "The budget could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "budget.created",
    entityType: "budget",
    entityId: budget.id,
    visibility,
    summary:
      visibility === "private"
        ? "You added a private budget"
        : `${name} added a budget`,
  });
  if (visibility !== "private") {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "budget.created",
      title: `${name} added a budget`,
      link: ROUTES.budgets,
    });
  }

  await refreshMoneyPages();
  return { success: true };
}

export async function createDebtAction(
  input: z.input<typeof debtSchema>
): Promise<ActionResult> {
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the debt details." };
  }

  const ctx = await requireWorkspace();
  const supabase = await createClient();
  const data = parsed.data;

  const { data: debt, error } = await supabase
    .from("debts")
    .insert({
      workspace_id: ctx.workspace.id,
      owner_id: ctx.user.id,
      name: data.name,
      debt_type: data.debtType,
      balance: data.balance,
      original_balance: data.balance,
      apr: data.apr,
      minimum_payment: data.minimumPayment,
      due_day: data.dueDay,
      visibility: data.visibility,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !debt) {
    return { error: "The debt could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "debt.created",
    entityType: "debt",
    entityId: debt.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You added a private debt: ${data.name}`
        : `${name} added a debt: ${data.name}`,
  });
  if (data.visibility !== "private") {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "debt.created",
      title: `${name} added a debt`,
      body: data.name,
      link: ROUTES.debts,
    });
  }

  await refreshMoneyPages();
  return { success: true };
}

export async function createGoalAction(
  input: z.input<typeof goalSchema>
): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the goal details." };
  }

  const ctx = await requireWorkspace();
  const supabase = await createClient();
  const { count } = await supabase
    .from("savings_goals")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspace.id);

  if (!canCreateGoal(ctx.plan, count ?? 0)) {
    return { error: "Your current plan has reached its goal limit." };
  }

  const data = parsed.data;
  const { data: goal, error } = await supabase
    .from("savings_goals")
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      name: data.name,
      goal_type: data.goalType,
      target_amount: data.targetAmount,
      target_date: data.targetDate || null,
      monthly_contribution:
        data.monthlyContribution > 0 ? data.monthlyContribution : null,
      visibility: data.visibility,
      emoji: data.emoji?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !goal) {
    return { error: "The goal could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "goal.created",
    entityType: "goal",
    entityId: goal.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You added a private goal: ${data.name}`
        : `${name} added a goal: ${data.name}`,
  });
  if (data.visibility !== "private") {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "goal.created",
      title: `${name} added a goal`,
      body: data.name,
      link: ROUTES.goals,
    });
  }

  await refreshMoneyPages();
  return { success: true };
}
