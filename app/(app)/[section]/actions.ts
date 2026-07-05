"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity, notifyPartner } from "@/lib/activity";
import {
  ASSET_CLASSES,
  CHECKIN_STATUSES,
  DECISION_TYPES,
  DEBT_TYPES,
  DOCUMENT_CATEGORIES,
  DOCUMENTS_BUCKET,
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES,
  GOAL_TYPES,
  RECURRENCE_FREQUENCIES,
  RESEARCH_STATUSES,
  RISK_LEVELS,
  ROUTES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  VISIBILITY_LEVELS,
} from "@/lib/constants";
import { requireWorkspace, type WorkspaceContext } from "@/lib/data/workspace";
import { canCreateGoal, canUploadDocument } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { success: true };

const idSchema = z.object({ id: z.uuid() });

const dollars = z
  .number()
  .finite()
  .positive("Enter an amount greater than zero")
  .max(100_000_000);

const optionalDollars = z.number().finite().min(0).max(100_000_000);
const optionalPositiveQuantity = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000_000)
  .nullable();

const shortText = (message: string) =>
  z.string().trim().min(1, message).max(100, "Keep it under 100 characters");

const optionalNotes = z
  .string()
  .trim()
  .max(500, "Keep notes under 500 characters")
  .optional();

const optionalDate = z.iso.date("Choose a valid date").optional().or(z.literal(""));

const stringList = z
  .array(z.string().trim().min(1).max(160))
  .max(20, "Keep the list short")
  .default([]);

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
const expenseWithIdSchema = expenseSchema.merge(idSchema);

const budgetSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: dollars,
  month: monthSchema,
  scope: z.enum(["household", "personal"]),
  visibility: z.enum(VISIBILITY_LEVELS),
  rollover: z.boolean(),
});
const budgetWithIdSchema = budgetSchema.merge(idSchema);

const billPaymentSchema = z.object({
  expenseId: z.uuid(),
  month: monthSchema,
  paidOn: z.iso.date("Choose a valid paid date"),
  amount: dollars,
  note: optionalNotes,
});

const billPaymentDeleteSchema = z.object({
  expenseId: z.uuid(),
  month: monthSchema,
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
const debtWithIdSchema = debtSchema.merge(idSchema);

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
const goalWithIdSchema = goalSchema.merge(idSchema);

const investmentSchema = z.object({
  name: shortText("Name this investment"),
  assetClass: z.enum(ASSET_CLASSES),
  accountName: z.string().trim().max(100, "Keep it under 100 characters").optional(),
  riskLevel: z.enum(RISK_LEVELS).nullable(),
  visibility: z.enum(VISIBILITY_LEVELS),
  isWatchlist: z.boolean(),
  holdingName: shortText("Name this holding"),
  symbol: z.string().trim().max(20, "Keep the symbol short").optional(),
  quantity: optionalPositiveQuantity,
  costBasis: optionalDollars.nullable(),
  currentValue: optionalDollars,
  asOf: optionalDate,
  notes: optionalNotes,
});
const investmentWithIdSchema = investmentSchema.extend({
  id: z.uuid(),
  holdingId: z.uuid(),
});

const emergencyFundSchema = z.object({
  name: shortText("Name this emergency fund"),
  targetAmount: dollars,
  currentSavings: optionalDollars,
  targetDate: optionalDate,
  monthlyContribution: optionalDollars,
  visibility: z.enum(VISIBILITY_LEVELS),
  notes: optionalNotes,
});

const researchSchema = z.object({
  title: shortText("Name this research item"),
  decisionType: z.enum(DECISION_TYPES),
  estimatedCost: optionalDollars.nullable(),
  pros: stringList,
  cons: stringList,
  visibility: z.enum(VISIBILITY_LEVELS),
  notes: optionalNotes,
});
const researchWithIdSchema = researchSchema.extend({
  id: z.uuid(),
  status: z.enum(RESEARCH_STATUSES),
  finalDecision: z.string().trim().max(500, "Keep the decision under 500 characters").optional(),
});

const checkinSchema = z.object({
  month: monthSchema,
  title: z.string().trim().max(100, "Keep it under 100 characters").optional(),
  scheduledFor: optionalDate,
  summary: optionalNotes,
});
const checkinWithIdSchema = checkinSchema.extend({
  id: z.uuid(),
  status: z.enum(CHECKIN_STATUSES),
});

const documentSchema = z.object({
  name: shortText("Name this document"),
  category: z.enum(DOCUMENT_CATEGORIES),
  storagePath: z.string().trim().min(1).max(500),
  fileSize: z.number().int().min(0).max(20 * 1024 * 1024).nullable(),
  mimeType: z.string().trim().max(120).nullable(),
  visibility: z.enum(VISIBILITY_LEVELS),
  expiresOn: optionalDate,
  reminderOn: optionalDate,
  notes: optionalNotes,
});
const documentUpdateSchema = z.object({
  id: z.uuid(),
  name: shortText("Name this document"),
  category: z.enum(DOCUMENT_CATEGORIES),
  visibility: z.enum(VISIBILITY_LEVELS),
  expiresOn: optionalDate,
  reminderOn: optionalDate,
  notes: optionalNotes,
});

const taskSchema = z.object({
  title: shortText("Name this task"),
  description: optionalNotes,
  assignedTo: z.uuid().nullable(),
  dueOn: optionalDate,
  priority: z.enum(TASK_PRIORITIES),
});
const taskWithIdSchema = taskSchema.extend({
  id: z.uuid(),
  status: z.enum(TASK_STATUSES),
});

function actorName(fullName: string | null, email: string): string {
  return fullName?.trim() || email || "Your partner";
}

function canManageExpense(
  row: { created_by: string; paid_by: string; visibility: string },
  userId: string
): boolean {
  return (
    row.created_by === userId ||
    row.paid_by === userId ||
    row.visibility === "household"
  );
}

function canManageOwnedOrHousehold(
  row: { owner_id?: string | null; created_by?: string; visibility: string },
  userId: string
): boolean {
  return (
    row.owner_id === userId ||
    row.owner_id === null ||
    row.created_by === userId ||
    row.visibility === "household"
  );
}

function canTrackBillPayment(
  row: { created_by: string; paid_by: string; visibility: string },
  userId: string
): boolean {
  return (
    row.visibility !== "private" ||
    row.created_by === userId ||
    row.paid_by === userId
  );
}

function demoReadOnly(ctx: WorkspaceContext): ActionResult | null {
  return ctx.isDemo
    ? { error: "Demo data is read-only. Create an account to save changes." }
    : null;
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
  revalidatePath(ROUTES.investments);
  revalidatePath(ROUTES.research);
  revalidatePath(ROUTES.checkins);
  revalidatePath(ROUTES.documents);
  revalidatePath(ROUTES.tasks);
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
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
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
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
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

export async function saveBillPaymentAction(
  input: z.input<typeof billPaymentSchema>
): Promise<ActionResult> {
  const parsed = billPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the bill payment details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const { data: bill } = await supabase
    .from("expenses")
    .select("id, description, created_by, paid_by, visibility, is_recurring")
    .eq("id", data.expenseId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!bill || !bill.is_recurring) {
    return { error: "That recurring bill could not be found." };
  }
  if (!canTrackBillPayment(bill, ctx.user.id)) {
    return { error: "You can only track bills visible to you." };
  }

  const { data: payment, error } = await supabase
    .from("bill_payments")
    .upsert(
      {
        workspace_id: ctx.workspace.id,
        expense_id: data.expenseId,
        month: data.month,
        paid_on: data.paidOn,
        amount: data.amount,
        note: data.note?.trim() || null,
        created_by: ctx.user.id,
      },
      { onConflict: "expense_id,month" }
    )
    .select("id")
    .single();

  if (error || !payment) {
    return { error: "The bill payment could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "bill_payment.saved",
    entityType: "expense",
    entityId: bill.id,
    visibility: bill.visibility,
    summary:
      bill.visibility === "private"
        ? `You marked a private bill paid: ${bill.description}`
        : `${name} marked a bill paid: ${bill.description}`,
    metadata: { month: data.month, paid_on: data.paidOn, amount: data.amount },
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteBillPaymentAction(
  input: z.input<typeof billPaymentDeleteSchema>
): Promise<ActionResult> {
  const parsed = billPaymentDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "That bill payment could not be found." };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const { data: bill } = await supabase
    .from("expenses")
    .select("id, description, created_by, paid_by, visibility, is_recurring")
    .eq("id", data.expenseId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!bill || !bill.is_recurring) {
    return { error: "That recurring bill could not be found." };
  }
  if (!canTrackBillPayment(bill, ctx.user.id)) {
    return { error: "You can only track bills visible to you." };
  }

  const { error } = await supabase
    .from("bill_payments")
    .delete()
    .eq("workspace_id", ctx.workspace.id)
    .eq("expense_id", data.expenseId)
    .eq("month", data.month);

  if (error) {
    return { error: "The bill payment could not be removed. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "bill_payment.removed",
    entityType: "expense",
    entityId: bill.id,
    visibility: bill.visibility,
    summary:
      bill.visibility === "private"
        ? `You marked a private bill unpaid: ${bill.description}`
        : `${name} marked a bill unpaid: ${bill.description}`,
    metadata: { month: data.month },
  });

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
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
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
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
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

export async function createInvestmentAction(
  input: z.input<typeof investmentSchema>
): Promise<ActionResult> {
  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the investment details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;

  const { data: investment, error } = await supabase
    .from("investments")
    .insert({
      workspace_id: ctx.workspace.id,
      owner_id: ctx.user.id,
      name: data.name,
      asset_class: data.assetClass,
      account_name: data.accountName?.trim() || null,
      risk_level: data.riskLevel,
      visibility: data.visibility,
      is_watchlist: data.isWatchlist,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !investment) {
    return { error: "The investment could not be saved. Please try again." };
  }

  const { error: holdingError } = await supabase
    .from("investment_holdings")
    .insert({
      investment_id: investment.id,
      name: data.holdingName,
      symbol: data.symbol?.trim() || null,
      quantity: data.quantity,
      cost_basis: data.costBasis,
      current_value: data.currentValue,
      as_of: data.asOf || null,
      notes: data.notes?.trim() || null,
    });

  if (holdingError) {
    await supabase.from("investments").delete().eq("id", investment.id);
    return { error: "The holding could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "investment.created",
    entityType: "investment",
    entityId: investment.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You added a private investment: ${data.name}`
        : `${name} added an investment: ${data.name}`,
  });
  if (data.visibility !== "private") {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "investment.created",
      title: `${name} added an investment`,
      body: data.name,
      link: ROUTES.investments,
    });
  }

  await refreshMoneyPages();
  return { success: true };
}

export async function createEmergencyFundAction(
  input: z.input<typeof emergencyFundSchema>
): Promise<ActionResult> {
  const parsed = emergencyFundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Check the emergency fund details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
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
      goal_type: "emergency_fund",
      target_amount: data.targetAmount,
      target_date: data.targetDate || null,
      monthly_contribution:
        data.monthlyContribution > 0 ? data.monthlyContribution : null,
      visibility: data.visibility,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !goal) {
    return { error: "The emergency fund could not be saved. Please try again." };
  }

  if (data.currentSavings > 0) {
    const { error: contributionError } = await supabase
      .from("goal_contributions")
      .insert({
        goal_id: goal.id,
        user_id: ctx.user.id,
        amount: data.currentSavings,
        contributed_on: new Date().toISOString().slice(0, 10),
        note: "Starting balance",
      });

    if (contributionError) {
      await supabase.from("savings_goals").delete().eq("id", goal.id);
      return {
        error: "The starting balance could not be saved. Please try again.",
      };
    }
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "emergency_fund.created",
    entityType: "goal",
    entityId: goal.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You added a private emergency fund: ${data.name}`
        : `${name} added an emergency fund: ${data.name}`,
  });
  if (data.visibility !== "private") {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "emergency_fund.created",
      title: `${name} added an emergency fund`,
      body: data.name,
      link: ROUTES.emergencyFund,
    });
  }

  await refreshMoneyPages();
  return { success: true };
}

export async function createResearchAction(
  input: z.input<typeof researchSchema>
): Promise<ActionResult> {
  const parsed = researchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the research details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;

  const { data: research, error } = await supabase
    .from("research_items")
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      title: data.title,
      decision_type: data.decisionType,
      estimated_cost: data.estimatedCost,
      pros: data.pros,
      cons: data.cons,
      visibility: data.visibility,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !research) {
    return { error: "The research item could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "research.created",
    entityType: "research",
    entityId: research.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You added private research: ${data.title}`
        : `${name} added research: ${data.title}`,
  });
  if (data.visibility !== "private") {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "research.created",
      title: `${name} added research`,
      body: data.title,
      link: ROUTES.research,
    });
  }

  await refreshMoneyPages();
  return { success: true };
}

export async function createCheckinAction(
  input: z.input<typeof checkinSchema>
): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the check-in details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;

  const { data: checkin, error } = await supabase
    .from("money_checkins")
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      month: data.month,
      title: data.title?.trim() || null,
      scheduled_for: data.scheduledFor || null,
      summary: data.summary?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !checkin) {
    return { error: "The check-in could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "checkin.created",
    entityType: "checkin",
    entityId: checkin.id,
    summary: `${name} started a money check-in`,
  });
  await notifyPartner(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    type: "checkin.created",
    title: `${name} started a money check-in`,
    body: data.title?.trim() || "Money check-in",
    link: ROUTES.checkins,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function createDocumentAction(
  input: z.input<typeof documentSchema>
): Promise<ActionResult> {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the document details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspace.id);

  if (!canUploadDocument(ctx.plan, count ?? 0)) {
    return { error: "Your current plan has reached its document limit." };
  }

  const data = parsed.data;
  const requiredPrefix = `${ctx.workspace.id}/${ctx.user.id}/`;
  if (!data.storagePath.startsWith(requiredPrefix)) {
    return { error: "The uploaded file path is not valid." };
  }

  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: ctx.workspace.id,
      owner_id: ctx.user.id,
      name: data.name,
      category: data.category,
      storage_path: data.storagePath,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      visibility: data.visibility,
      expires_on: data.expiresOn || null,
      reminder_on: data.reminderOn || null,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !document) {
    return { error: "The document could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "document.created",
    entityType: "document",
    entityId: document.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You added a private document: ${data.name}`
        : `${name} added a document: ${data.name}`,
  });
  if (data.visibility !== "private") {
    await notifyPartner(supabase, {
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      type: "document.created",
      title: `${name} added a document`,
      body: data.name,
      link: ROUTES.documents,
    });
  }

  await refreshMoneyPages();
  return { success: true };
}

export async function createTaskAction(
  input: z.input<typeof taskSchema>
): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the task details." };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const data = parsed.data;
  if (
    data.assignedTo &&
    !ctx.members.some((member) => member.user_id === data.assignedTo)
  ) {
    return { error: "Choose someone from this workspace." };
  }

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      assigned_to: data.assignedTo,
      title: data.title,
      description: data.description?.trim() || null,
      due_on: data.dueOn || null,
      priority: data.priority,
    })
    .select("id")
    .single();

  if (error || !task) {
    return { error: "The task could not be saved. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "task.created",
    entityType: "task",
    entityId: task.id,
    summary: `${name} added a task: ${data.title}`,
  });
  await notifyPartner(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    type: "task.created",
    title: `${name} added a task`,
    body: data.title,
    link: ROUTES.tasks,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateInvestmentAction(
  input: z.input<typeof investmentWithIdSchema>
): Promise<ActionResult> {
  const parsed = investmentWithIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the investment details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const { data: existing } = await supabase
    .from("investments")
    .select("id, owner_id, visibility")
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That investment could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the owner can edit this investment. Household investments can be edited by either partner.",
    };
  }

  const { data: investment, error } = await supabase
    .from("investments")
    .update({
      name: data.name,
      asset_class: data.assetClass,
      account_name: data.accountName?.trim() || null,
      risk_level: data.riskLevel,
      visibility: data.visibility,
      is_watchlist: data.isWatchlist,
      notes: data.notes?.trim() || null,
    })
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !investment) {
    return { error: "The investment could not be updated. Please try again." };
  }

  const { data: holding, error: holdingError } = await supabase
    .from("investment_holdings")
    .update({
      name: data.holdingName,
      symbol: data.symbol?.trim() || null,
      quantity: data.quantity,
      cost_basis: data.costBasis,
      current_value: data.currentValue,
      as_of: data.asOf || null,
      notes: data.notes?.trim() || null,
    })
    .eq("id", data.holdingId)
    .eq("investment_id", data.id)
    .select("id")
    .maybeSingle();

  if (holdingError || !holding) {
    return { error: "The holding could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "investment.updated",
    entityType: "investment",
    entityId: investment.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You updated a private investment: ${data.name}`
        : `${name} updated an investment: ${data.name}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteInvestmentAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That investment could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("investments")
    .select("id, name, owner_id, visibility")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That investment could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the owner can delete this investment. Household investments can be deleted by either partner.",
    };
  }

  const { error } = await supabase
    .from("investments")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The investment could not be deleted. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "investment.deleted",
    entityType: "investment",
    entityId: existing.id,
    visibility: existing.visibility,
    summary:
      existing.visibility === "private"
        ? `You deleted a private investment: ${existing.name}`
        : `${name} deleted an investment: ${existing.name}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateResearchAction(
  input: z.input<typeof researchWithIdSchema>
): Promise<ActionResult> {
  const parsed = researchWithIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the research details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const { data: existing } = await supabase
    .from("research_items")
    .select("created_by, visibility")
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That research item could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the creator can edit this research item. Household research can be edited by either partner.",
    };
  }

  const { data: research, error } = await supabase
    .from("research_items")
    .update({
      title: data.title,
      decision_type: data.decisionType,
      estimated_cost: data.estimatedCost,
      pros: data.pros,
      cons: data.cons,
      status: data.status,
      final_decision: data.finalDecision?.trim() || null,
      decided_at: data.status === "decided" ? new Date().toISOString() : null,
      visibility: data.visibility,
      notes: data.notes?.trim() || null,
    })
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !research) {
    return { error: "The research item could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "research.updated",
    entityType: "research",
    entityId: research.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You updated private research: ${data.title}`
        : `${name} updated research: ${data.title}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteResearchAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That research item could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("research_items")
    .select("id, title, created_by, visibility")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That research item could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the creator can delete this research item. Household research can be deleted by either partner.",
    };
  }

  const { error } = await supabase
    .from("research_items")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The research item could not be deleted. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "research.deleted",
    entityType: "research",
    entityId: existing.id,
    visibility: existing.visibility,
    summary:
      existing.visibility === "private"
        ? `You deleted private research: ${existing.title}`
        : `${name} deleted research: ${existing.title}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateCheckinAction(
  input: z.input<typeof checkinWithIdSchema>
): Promise<ActionResult> {
  const parsed = checkinWithIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the check-in details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;

  const { data: checkin, error } = await supabase
    .from("money_checkins")
    .update({
      month: data.month,
      title: data.title?.trim() || null,
      status: data.status,
      scheduled_for: data.scheduledFor || null,
      summary: data.summary?.trim() || null,
      completed_at: data.status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !checkin) {
    return { error: "The check-in could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "checkin.updated",
    entityType: "checkin",
    entityId: checkin.id,
    summary: `${name} updated a money check-in`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteCheckinAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That check-in could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("money_checkins")
    .select("id, title")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That check-in could not be found." };

  const { error } = await supabase
    .from("money_checkins")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The check-in could not be deleted. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "checkin.deleted",
    entityType: "checkin",
    entityId: existing.id,
    summary: `${name} deleted a money check-in`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateDocumentAction(
  input: z.input<typeof documentUpdateSchema>
): Promise<ActionResult> {
  const parsed = documentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the document details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const { data: existing } = await supabase
    .from("documents")
    .select("owner_id, visibility")
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That document could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the owner can edit this document. Household documents can be edited by either partner.",
    };
  }

  const { data: document, error } = await supabase
    .from("documents")
    .update({
      name: data.name,
      category: data.category,
      visibility: data.visibility,
      expires_on: data.expiresOn || null,
      reminder_on: data.reminderOn || null,
      notes: data.notes?.trim() || null,
    })
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !document) {
    return { error: "The document could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "document.updated",
    entityType: "document",
    entityId: document.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You updated a private document: ${data.name}`
        : `${name} updated a document: ${data.name}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteDocumentAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That document could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("documents")
    .select("id, name, owner_id, visibility, storage_path")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That document could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the owner can delete this document. Household documents can be deleted by either partner.",
    };
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The document could not be deleted. Please try again." };
  }

  if (existing.owner_id === ctx.user.id) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([existing.storage_path]);
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "document.deleted",
    entityType: "document",
    entityId: existing.id,
    visibility: existing.visibility,
    summary:
      existing.visibility === "private"
        ? `You deleted a private document: ${existing.name}`
        : `${name} deleted a document: ${existing.name}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateTaskAction(
  input: z.input<typeof taskWithIdSchema>
): Promise<ActionResult> {
  const parsed = taskWithIdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the task details." };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const data = parsed.data;
  if (
    data.assignedTo &&
    !ctx.members.some((member) => member.user_id === data.assignedTo)
  ) {
    return { error: "Choose someone from this workspace." };
  }

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .update({
      assigned_to: data.assignedTo,
      title: data.title,
      description: data.description?.trim() || null,
      due_on: data.dueOn || null,
      status: data.status,
      priority: data.priority,
      completed_at: data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !task) {
    return { error: "The task could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "task.updated",
    entityType: "task",
    entityId: task.id,
    summary: `${name} updated a task: ${data.title}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteTaskAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That task could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That task could not be found." };

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The task could not be deleted. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "task.deleted",
    entityType: "task",
    entityId: existing.id,
    summary: `${name} deleted a task: ${existing.title}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateExpenseAction(
  input: z.input<typeof expenseWithIdSchema>
): Promise<ActionResult> {
  const parsed = expenseWithIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the expense details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const expenseType =
    data.visibility === "private" ? "personal" : data.expenseType;
  const { data: existing } = await supabase
    .from("expenses")
    .select("created_by, paid_by, visibility")
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That expense could not be found." };
  if (!canManageExpense(existing, ctx.user.id)) {
    return {
      error:
        "Only the person who created or paid this expense can edit it. Household expenses can be edited by either partner.",
    };
  }

  const { data: expense, error } = await supabase
    .from("expenses")
    .update({
      description: data.description,
      amount: data.amount,
      category: data.category,
      expense_date: data.expenseDate,
      expense_type: expenseType,
      visibility: data.visibility,
      is_recurring: data.isRecurring,
      recurrence: data.isRecurring ? data.recurrence ?? "monthly" : null,
      merchant: data.merchant?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !expense) {
    return { error: "The expense could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "expense.updated",
    entityType: "expense",
    entityId: expense.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You updated a private expense: ${data.description}`
        : `${name} updated an expense: ${data.description}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteExpenseAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That expense could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("expenses")
    .select("id, description, created_by, paid_by, visibility")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That expense could not be found." };
  if (!canManageExpense(existing, ctx.user.id)) {
    return {
      error:
        "Only the person who created or paid this expense can delete it. Household expenses can be deleted by either partner.",
    };
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The expense could not be deleted. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "expense.deleted",
    entityType: "expense",
    entityId: existing.id,
    visibility: existing.visibility,
    summary:
      existing.visibility === "private"
        ? `You deleted a private expense: ${existing.description}`
        : `${name} deleted an expense: ${existing.description}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateBudgetAction(
  input: z.input<typeof budgetWithIdSchema>
): Promise<ActionResult> {
  const parsed = budgetWithIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the budget details.",
    };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const isHousehold = data.scope === "household";
  const visibility = isHousehold ? "household" : data.visibility;
  const { data: existing } = await supabase
    .from("budgets")
    .select("owner_id, visibility")
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That budget could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the owner can edit this personal budget. Household budgets can be edited by either partner.",
    };
  }

  const { data: budget, error } = await supabase
    .from("budgets")
    .update({
      category: data.category,
      amount: data.amount,
      month: data.month,
      scope: data.scope,
      owner_id: isHousehold ? null : ctx.user.id,
      visibility,
      rollover: data.rollover,
    })
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") {
    return { error: "That budget already exists for this month." };
  }
  if (error || !budget) {
    return { error: "The budget could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "budget.updated",
    entityType: "budget",
    entityId: budget.id,
    visibility,
    summary:
      visibility === "private"
        ? "You updated a private budget"
        : `${name} updated a budget`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteBudgetAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That budget could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("budgets")
    .select("id, visibility")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That budget could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the owner can delete this personal budget. Household budgets can be deleted by either partner.",
    };
  }

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The budget could not be deleted. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "budget.deleted",
    entityType: "budget",
    entityId: existing.id,
    visibility: existing.visibility,
    summary:
      existing.visibility === "private"
        ? "You deleted a private budget"
        : `${name} deleted a budget`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateDebtAction(
  input: z.input<typeof debtWithIdSchema>
): Promise<ActionResult> {
  const parsed = debtWithIdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the debt details." };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const { data: existing } = await supabase
    .from("debts")
    .select("owner_id, visibility")
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That debt could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the owner can edit this debt. Household debts can be edited by either partner.",
    };
  }

  const { data: debt, error } = await supabase
    .from("debts")
    .update({
      name: data.name,
      debt_type: data.debtType,
      balance: data.balance,
      apr: data.apr,
      minimum_payment: data.minimumPayment,
      due_day: data.dueDay,
      visibility: data.visibility,
      notes: data.notes?.trim() || null,
    })
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !debt) {
    return { error: "The debt could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "debt.updated",
    entityType: "debt",
    entityId: debt.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You updated a private debt: ${data.name}`
        : `${name} updated a debt: ${data.name}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteDebtAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That debt could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("debts")
    .select("id, name, visibility")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That debt could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the owner can delete this debt. Household debts can be deleted by either partner.",
    };
  }

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The debt could not be deleted. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "debt.deleted",
    entityType: "debt",
    entityId: existing.id,
    visibility: existing.visibility,
    summary:
      existing.visibility === "private"
        ? `You deleted a private debt: ${existing.name}`
        : `${name} deleted a debt: ${existing.name}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function updateGoalAction(
  input: z.input<typeof goalWithIdSchema>
): Promise<ActionResult> {
  const parsed = goalWithIdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the goal details." };
  }

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const data = parsed.data;
  const { data: existing } = await supabase
    .from("savings_goals")
    .select("created_by, visibility")
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That goal could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the creator can edit this goal. Household goals can be edited by either partner.",
    };
  }

  const { data: goal, error } = await supabase
    .from("savings_goals")
    .update({
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
    .eq("id", data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !goal) {
    return { error: "The goal could not be updated. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "goal.updated",
    entityType: "goal",
    entityId: goal.id,
    visibility: data.visibility,
    summary:
      data.visibility === "private"
        ? `You updated a private goal: ${data.name}`
        : `${name} updated a goal: ${data.name}`,
  });

  await refreshMoneyPages();
  return { success: true };
}

export async function deleteGoalAction(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That goal could not be found." };

  const ctx = await requireWorkspace();
  const demoError = demoReadOnly(ctx);
  if (demoError) return demoError;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("savings_goals")
    .select("id, name, visibility")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) return { error: "That goal could not be found." };
  if (!canManageOwnedOrHousehold(existing, ctx.user.id)) {
    return {
      error:
        "Only the creator can delete this goal. Household goals can be deleted by either partner.",
    };
  }

  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", existing.id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    return { error: "The goal could not be deleted. Please try again." };
  }

  const name = actorName(ctx.profile.full_name, ctx.profile.email);
  await logActivity(supabase, {
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    eventType: "goal.deleted",
    entityType: "goal",
    entityId: existing.id,
    visibility: existing.visibility,
    summary:
      existing.visibility === "private"
        ? `You deleted a private goal: ${existing.name}`
        : `${name} deleted a goal: ${existing.name}`,
  });

  await refreshMoneyPages();
  return { success: true };
}
