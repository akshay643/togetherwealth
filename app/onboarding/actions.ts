"use server";

/**
 * Server actions for the onboarding wizard — one per step.
 *
 * Every action:
 * - re-validates its payload with zod (never trust the client),
 * - writes as the signed-in user (RLS enforced),
 * - persists forward progress to profiles.onboarding_step so a refresh
 *   resumes where the person left off,
 * - returns { error } on failure (shown as a calm toast client-side).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logActivity, notifyPartner } from "@/lib/activity";
import { MONEY_STYLE_META, ROUTES } from "@/lib/constants";
import { canCreateGoal, getWorkspacePlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";
import {
  GOAL_EMOJI,
  TOTAL_STEPS,
  type WizardWorkspace,
} from "./_components/wizard-constants";
import {
  createWorkspaceSchema,
  debtsStepPayloadSchema,
  finishStepPayloadSchema,
  goalsStepPayloadSchema,
  incomeStepPayloadSchema,
  invitePartnerSchema,
  investmentsStepPayloadSchema,
  joinWorkspaceSchema,
  moneyStyleSchema,
  privacySchema,
  profileStepSchema,
  savingsStepPayloadSchema,
  skipStepSchema,
  type CreateWorkspaceInput,
  type DebtsStepPayload,
  type FinishStepPayload,
  type GoalsStepPayload,
  type IncomeStepPayload,
  type InvestmentsStepPayload,
  type InvitePartnerInput,
  type JoinWorkspaceInput,
  type MoneyStyleInput,
  type PrivacyInput,
  type ProfileStepInput,
  type SavingsStepPayload,
  type SkipStepInput,
} from "./_components/wizard-schemas";

type Supabase = SupabaseClient<Database>;

const GENERIC_ERROR =
  "Something didn't save just now. Please try again in a moment.";
const SESSION_ERROR = "Your session has expired — please log in again.";
const NO_WORKSPACE_ERROR =
  "Set up your couple space first — go back a couple of steps and we'll get you there.";

/** Steps that may be skipped (or continued without new data). */
const SKIPPABLE_STEPS = new Set([1, 2, 5, 6, 7, 8, 9]);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function getMembership(supabase: Supabase, userId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function getProfileBasics(supabase: Supabase, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, currency, onboarding_step")
    .eq("id", userId)
    .maybeSingle();
  return {
    name: data?.full_name ?? data?.email ?? "Your partner",
    currency: data?.currency ?? "USD",
    step: data?.onboarding_step ?? 0,
  };
}

/** Move onboarding_step forward (never backward — Back is a local affair). */
async function advanceStep(supabase: Supabase, userId: string, next: number) {
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_step")
    .eq("id", userId)
    .maybeSingle();
  const current = data?.onboarding_step ?? 0;
  if (next <= current) return;
  await supabase
    .from("profiles")
    .update({ onboarding_step: Math.min(next, TOTAL_STEPS) })
    .eq("id", userId);
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Log aggregate setup activity without leaking private items: non-private
 * items get a shared event, private items get a separate private one
 * (only ever visible to the actor).
 */
async function logSetupItems(
  supabase: Supabase,
  params: {
    workspaceId: string;
    userId: string;
    actorName: string;
    eventType: string;
    entityType: string;
    sharedCount: number;
    privateCount: number;
    noun: string;
    nounPlural: string;
  }
) {
  const {
    workspaceId,
    userId,
    actorName,
    eventType,
    entityType,
    sharedCount,
    privateCount,
    noun,
    nounPlural,
  } = params;
  if (sharedCount > 0) {
    await logActivity(supabase, {
      workspaceId,
      actorId: userId,
      eventType,
      entityType,
      summary: `${actorName} added ${sharedCount} ${
        sharedCount === 1 ? noun : nounPlural
      } during setup`,
      visibility: "shared",
    });
  }
  if (privateCount > 0) {
    await logActivity(supabase, {
      workspaceId,
      actorId: userId,
      eventType,
      entityType,
      summary: `You added ${privateCount} private ${
        privateCount === 1 ? noun : nounPlural
      } during setup`,
      visibility: "private",
    });
  }
}

// ---------------------------------------------------------------------------
// Step 0 — personal profile
// ---------------------------------------------------------------------------

export async function saveProfileStepAction(
  input: ProfileStepInput
): Promise<{ error?: string }> {
  const parsed = profileStepSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      currency: parsed.data.currency,
    })
    .eq("id", user.id);
  if (error) return { error: GENERIC_ERROR };

  await advanceStep(supabase, user.id, 1);
  return {};
}

// ---------------------------------------------------------------------------
// Step 1 — create or join the couple workspace
// ---------------------------------------------------------------------------

export async function createWorkspaceAction(
  input: CreateWorkspaceInput
): Promise<{ error?: string; workspace?: WizardWorkspace }> {
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  // Already in a workspace (double submit, or joined elsewhere)? Reuse it.
  const membership = await getMembership(supabase, user.id);
  if (membership) {
    const { data: existing } = await supabase
      .from("couple_workspaces")
      .select("id, name, money_style")
      .eq("id", membership.workspace_id)
      .maybeSingle();
    if (existing) {
      await advanceStep(
        supabase,
        user.id,
        membership.role === "owner" ? 2 : 3
      );
      return {
        workspace: {
          id: existing.id,
          name: existing.name,
          role: membership.role,
          moneyStyle: existing.money_style,
        },
      };
    }
  }

  const profile = await getProfileBasics(supabase, user.id);

  // The DB trigger adds the owner membership + a free subscription.
  const { data: workspace, error } = await supabase
    .from("couple_workspaces")
    .insert({
      name: parsed.data.name,
      created_by: user.id,
      currency: profile.currency,
    })
    .select("id, name, money_style")
    .single();
  if (error || !workspace) return { error: GENERIC_ERROR };

  await logActivity(supabase, {
    workspaceId: workspace.id,
    actorId: user.id,
    eventType: "workspace.created",
    summary: `${profile.name} created the space "${workspace.name}"`,
    entityType: "workspace",
    entityId: workspace.id,
    visibility: "household",
  });

  await advanceStep(supabase, user.id, 2);
  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      role: "owner",
      moneyStyle: workspace.money_style,
    },
  };
}

/**
 * The accept_partner_invite RPC raises calm, user-facing messages.
 * Pass those through verbatim; anything else gets a generic fallback.
 */
const KNOWN_INVITE_ERRORS = [
  "This invite link is not valid.",
  "This invite is no longer active.",
  "This invite has expired. Ask your partner to send a new one.",
  "This invite was sent to a different email address. Sign in with the invited email to accept it.",
  "You must be signed in to accept an invite.",
];

/** Accept a pasted invite link or bare token. */
export async function joinWorkspaceAction(
  input: JoinWorkspaceInput
): Promise<{ error?: string; workspace?: WizardWorkspace }> {
  const parsed = joinWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  // Accept either the full /invite/{token} link or the bare token.
  const raw = parsed.data.token;
  const linkMatch = raw.match(/invite\/([^/?#\s]+)/);
  const token = (
    linkMatch?.[1] ??
    raw.split("/").filter(Boolean).pop() ??
    raw
  ).trim();

  async function workspaceSlice(
    workspaceId: string,
    role: "owner" | "partner"
  ): Promise<WizardWorkspace | null> {
    const { data: ws } = await supabase
      .from("couple_workspaces")
      .select("id, name, money_style")
      .eq("id", workspaceId)
      .maybeSingle();
    return ws
      ? { id: ws.id, name: ws.name, role, moneyStyle: ws.money_style }
      : null;
  }

  // Already a member (e.g. accepted via the emailed link)? Just advance.
  const existing = await getMembership(supabase, user.id);
  if (existing) {
    const workspace = await workspaceSlice(
      existing.workspace_id,
      existing.role
    );
    if (workspace) {
      await advanceStep(supabase, user.id, existing.role === "owner" ? 2 : 3);
      return { workspace };
    }
  }

  const { data: workspaceId, error } = await supabase.rpc(
    "accept_partner_invite",
    { invite_token: token }
  );
  if (error || !workspaceId) {
    const message = error?.message ?? "";
    const known = KNOWN_INVITE_ERRORS.find((m) => message.includes(m));
    return {
      error:
        known ??
        "We couldn't find that invite. Double-check the link, or ask your partner to send a new one.",
    };
  }

  const profile = await getProfileBasics(supabase, user.id);

  await logActivity(supabase, {
    workspaceId,
    actorId: user.id,
    eventType: "member.joined",
    summary: `${profile.name} accepted the invite and joined the workspace`,
    entityType: "workspace",
    entityId: workspaceId,
    visibility: "household",
  });
  await notifyPartner(supabase, {
    workspaceId,
    actorId: user.id,
    type: "member.joined",
    title: `${profile.name} accepted your invite`,
    body: "You're now planning money together in TogetherWealth.",
    link: ROUTES.dashboard,
  });

  await advanceStep(supabase, user.id, 3);
  const workspace = await workspaceSlice(workspaceId, "partner");
  if (!workspace) return { error: GENERIC_ERROR };
  return { workspace };
}

// ---------------------------------------------------------------------------
// Step 2 — invite partner (creator only, skippable)
// ---------------------------------------------------------------------------

export async function createInviteAction(
  input: InvitePartnerInput
): Promise<{ error?: string; inviteUrl?: string; email?: string }> {
  const parsed = invitePartnerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: NO_WORKSPACE_ERROR };
  if (membership.role !== "owner") {
    return {
      error: "Only the person who created the space can send invites.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  if (email === (user.email ?? "").toLowerCase()) {
    return {
      error: "That looks like your own email — enter your partner's instead.",
    };
  }

  // Reuse a still-valid pending invite to the same address.
  const { data: pending } = await supabase
    .from("partner_invites")
    .select("token, email")
    .eq("workspace_id", membership.workspace_id)
    .eq("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending) {
    return {
      inviteUrl: `${appBaseUrl()}${ROUTES.invite(pending.token)}`,
      email: pending.email,
    };
  }

  const { data: invite, error } = await supabase
    .from("partner_invites")
    .insert({
      workspace_id: membership.workspace_id,
      email,
      invited_by: user.id,
      message: parsed.data.message?.trim() ? parsed.data.message.trim() : null,
    })
    .select("token, email")
    .single();
  if (error || !invite) return { error: GENERIC_ERROR };

  const profile = await getProfileBasics(supabase, user.id);
  await logActivity(supabase, {
    workspaceId: membership.workspace_id,
    actorId: user.id,
    eventType: "invite.sent",
    summary: `${profile.name} invited ${invite.email} to join the space`,
    entityType: "workspace",
    entityId: membership.workspace_id,
    visibility: "household",
  });

  return {
    inviteUrl: `${appBaseUrl()}${ROUTES.invite(invite.token)}`,
    email: invite.email,
  };
}

// ---------------------------------------------------------------------------
// Step 3 — money style
// ---------------------------------------------------------------------------

export async function saveMoneyStyleAction(
  input: MoneyStyleInput
): Promise<{ error?: string }> {
  const parsed = moneyStyleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: NO_WORKSPACE_ERROR };

  const { error } = await supabase
    .from("profiles")
    .update({ money_style_pref: parsed.data.moneyStyle })
    .eq("id", user.id);
  if (error) return { error: GENERIC_ERROR };

  // Only the owner sets the shared workspace style; partners record a
  // personal preference to talk over together later.
  if (membership.role === "owner") {
    const { error: wsError } = await supabase
      .from("couple_workspaces")
      .update({ money_style: parsed.data.moneyStyle })
      .eq("id", membership.workspace_id);
    if (wsError) return { error: GENERIC_ERROR };

    const profile = await getProfileBasics(supabase, user.id);
    await logActivity(supabase, {
      workspaceId: membership.workspace_id,
      actorId: user.id,
      eventType: "workspace.money_style_updated",
      summary: `${profile.name} set the money style to ${
        MONEY_STYLE_META[parsed.data.moneyStyle].label
      }`,
      entityType: "workspace",
      entityId: membership.workspace_id,
      visibility: "household",
    });
  }

  await advanceStep(supabase, user.id, 4);
  return {};
}

// ---------------------------------------------------------------------------
// Step 4 — privacy preferences
// ---------------------------------------------------------------------------

export async function savePrivacyAction(
  input: PrivacyInput
): Promise<{ error?: string }> {
  const parsed = privacySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const { error } = await supabase
    .from("profiles")
    .update({ share_personal_net_worth: parsed.data.sharePersonalNetWorth })
    .eq("id", user.id);
  if (error) return { error: GENERIC_ERROR };

  await advanceStep(supabase, user.id, 5);
  return {};
}

// ---------------------------------------------------------------------------
// Step 5 — income & fixed expenses
// ---------------------------------------------------------------------------

export async function saveIncomeStepAction(
  input: IncomeStepPayload
): Promise<{ error?: string }> {
  const parsed = incomeStepPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: NO_WORKSPACE_ERROR };
  const workspaceId = membership.workspace_id;
  const { incomes, bills, billsVisibility } = parsed.data;

  if (incomes.length > 0) {
    const { error } = await supabase.from("income_sources").insert(
      incomes.map((income) => ({
        workspace_id: workspaceId,
        owner_id: user.id,
        name: income.name,
        income_type: income.incomeType,
        amount: income.amount,
        frequency: income.frequency,
        visibility: income.visibility,
      }))
    );
    if (error) return { error: GENERIC_ERROR };
  }

  if (bills.length > 0) {
    const today = todayDate();
    const { error } = await supabase.from("expenses").insert(
      bills.map((bill) => ({
        workspace_id: workspaceId,
        created_by: user.id,
        paid_by: user.id,
        description: bill.label,
        amount: bill.amount,
        category: bill.category,
        expense_date: today,
        expense_type:
          billsVisibility === "private"
            ? ("personal" as const)
            : ("shared" as const),
        visibility: billsVisibility,
        is_recurring: true,
        recurrence: "monthly" as const,
        split_method: "none" as const,
      }))
    );
    if (error) return { error: GENERIC_ERROR };
  }

  if (incomes.length > 0 || bills.length > 0) {
    const profile = await getProfileBasics(supabase, user.id);
    await logSetupItems(supabase, {
      workspaceId,
      userId: user.id,
      actorName: profile.name,
      eventType: "income.created",
      entityType: "income_source",
      sharedCount: incomes.filter((i) => i.visibility !== "private").length,
      privateCount: incomes.filter((i) => i.visibility === "private").length,
      noun: "income source",
      nounPlural: "income sources",
    });
    await logSetupItems(supabase, {
      workspaceId,
      userId: user.id,
      actorName: profile.name,
      eventType: "expense.created",
      entityType: "expense",
      sharedCount: billsVisibility !== "private" ? bills.length : 0,
      privateCount: billsVisibility === "private" ? bills.length : 0,
      noun: "monthly bill",
      nounPlural: "monthly bills",
    });
  }

  await advanceStep(supabase, user.id, 6);
  return {};
}

// ---------------------------------------------------------------------------
// Step 6 — debts (skippable)
// ---------------------------------------------------------------------------

export async function saveDebtsStepAction(
  input: DebtsStepPayload
): Promise<{ error?: string }> {
  const parsed = debtsStepPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: NO_WORKSPACE_ERROR };
  const { debts } = parsed.data;

  if (debts.length > 0) {
    const { error } = await supabase.from("debts").insert(
      debts.map((debt) => ({
        workspace_id: membership.workspace_id,
        owner_id: user.id,
        name: debt.name,
        debt_type: debt.debtType,
        balance: debt.balance,
        original_balance: debt.balance,
        apr: debt.apr,
        minimum_payment: debt.minimumPayment,
        visibility: debt.visibility,
      }))
    );
    if (error) return { error: GENERIC_ERROR };

    const profile = await getProfileBasics(supabase, user.id);
    await logSetupItems(supabase, {
      workspaceId: membership.workspace_id,
      userId: user.id,
      actorName: profile.name,
      eventType: "debt.created",
      entityType: "debt",
      sharedCount: debts.filter((d) => d.visibility !== "private").length,
      privateCount: debts.filter((d) => d.visibility === "private").length,
      noun: "debt",
      nounPlural: "debts",
    });
  }

  await advanceStep(supabase, user.id, 7);
  return {};
}

// ---------------------------------------------------------------------------
// Step 7 — savings & emergency fund
// ---------------------------------------------------------------------------

export async function saveSavingsStepAction(
  input: SavingsStepPayload
): Promise<{ error?: string; warning?: string }> {
  const parsed = savingsStepPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: NO_WORKSPACE_ERROR };
  const workspaceId = membership.workspace_id;
  const data = parsed.data;
  const profile = await getProfileBasics(supabase, user.id);
  const today = todayDate();
  let warning: string | undefined;

  if (data.currentSavings > 0) {
    const { error } = await supabase.from("accounts").insert({
      workspace_id: workspaceId,
      owner_id: user.id,
      name: "Savings",
      type: "savings",
      balance: data.currentSavings,
      currency: profile.currency,
      visibility: data.savingsVisibility,
    });
    if (error) return { error: GENERIC_ERROR };

    await logActivity(supabase, {
      workspaceId,
      actorId: user.id,
      eventType: "account.created",
      summary:
        data.savingsVisibility === "private"
          ? "You added a private savings account during setup"
          : `${profile.name} added a savings account during setup`,
      entityType: "account",
      visibility: data.savingsVisibility,
    });
  }

  if (data.monthlyEssentials > 0) {
    // One emergency fund per couple: if a visible one already exists
    // (e.g. your partner set it up), contribute to it instead.
    const { data: existingGoal } = await supabase
      .from("savings_goals")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .eq("goal_type", "emergency_fund")
      .eq("status", "active")
      .neq("visibility", "private")
      .limit(1)
      .maybeSingle();

    let goalId: string;
    if (existingGoal) {
      goalId = existingGoal.id;
      warning =
        "You two already have an emergency fund goal, so we didn't create a second one.";
    } else {
      const { data: goal, error } = await supabase
        .from("savings_goals")
        .insert({
          workspace_id: workspaceId,
          created_by: user.id,
          name: "Emergency fund",
          goal_type: "emergency_fund",
          target_amount:
            Math.round(data.targetMonths * data.monthlyEssentials * 100) / 100,
          monthly_contribution:
            data.emergencyMonthlyContribution > 0
              ? data.emergencyMonthlyContribution
              : null,
          visibility: "shared",
          emoji: GOAL_EMOJI.emergency_fund,
        })
        .select("id")
        .single();
      if (error || !goal) return { error: GENERIC_ERROR };
      goalId = goal.id;

      await logActivity(supabase, {
        workspaceId,
        actorId: user.id,
        eventType: "goal.created",
        summary: `${profile.name} set up an emergency fund goal (${data.targetMonths} months of essentials)`,
        entityType: "goal",
        entityId: goalId,
        visibility: "shared",
      });
      await notifyPartner(supabase, {
        workspaceId,
        actorId: user.id,
        type: "goal.created",
        title: `${profile.name} set up an emergency fund goal`,
        body: "Take a look and add your thoughts when you have a moment.",
        link: ROUTES.goals,
      });
    }

    if (data.emergencyCurrentAmount > 0) {
      const { error } = await supabase.from("goal_contributions").insert({
        goal_id: goalId,
        user_id: user.id,
        amount: data.emergencyCurrentAmount,
        contributed_on: today,
        note: "Starting amount from setup",
      });
      if (error) return { error: GENERIC_ERROR };
      if (existingGoal) {
        warning =
          "You two already have an emergency fund goal — we added your starting amount to it instead of creating a second one.";
      }
    }
  }

  await advanceStep(supabase, user.id, 8);
  return warning ? { warning } : {};
}

// ---------------------------------------------------------------------------
// Step 8 — investments (skippable)
// ---------------------------------------------------------------------------

export async function saveInvestmentsStepAction(
  input: InvestmentsStepPayload
): Promise<{ error?: string }> {
  const parsed = investmentsStepPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: NO_WORKSPACE_ERROR };
  const { investments } = parsed.data;
  const today = todayDate();

  for (const inv of investments) {
    const { data: created, error } = await supabase
      .from("investments")
      .insert({
        workspace_id: membership.workspace_id,
        owner_id: user.id,
        name: inv.name,
        asset_class: inv.assetClass,
        risk_level: inv.riskLevel,
        visibility: inv.visibility,
      })
      .select("id")
      .single();
    if (error || !created) return { error: GENERIC_ERROR };

    const { error: holdingError } = await supabase
      .from("investment_holdings")
      .insert({
        investment_id: created.id,
        name: inv.name,
        current_value: inv.currentValue,
        as_of: today,
      });
    if (holdingError) return { error: GENERIC_ERROR };
  }

  if (investments.length > 0) {
    const profile = await getProfileBasics(supabase, user.id);
    await logSetupItems(supabase, {
      workspaceId: membership.workspace_id,
      userId: user.id,
      actorName: profile.name,
      eventType: "investment.created",
      entityType: "investment",
      sharedCount: investments.filter((i) => i.visibility !== "private")
        .length,
      privateCount: investments.filter((i) => i.visibility === "private")
        .length,
      noun: "investment",
      nounPlural: "investments",
    });
  }

  await advanceStep(supabase, user.id, 9);
  return {};
}

// ---------------------------------------------------------------------------
// Step 9 — shared goals
// ---------------------------------------------------------------------------

export async function saveSharedGoalsStepAction(
  input: GoalsStepPayload
): Promise<{ error?: string; warning?: string }> {
  const parsed = goalsStepPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: NO_WORKSPACE_ERROR };
  const workspaceId = membership.workspace_id;
  const { goals } = parsed.data;

  let added = 0;
  let skipped = 0;

  if (goals.length > 0) {
    const plan = await getWorkspacePlan(supabase, workspaceId);
    const { count } = await supabase
      .from("savings_goals")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    let existing = count ?? 0;

    for (const goal of goals) {
      if (!canCreateGoal(plan, existing)) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase.from("savings_goals").insert({
        workspace_id: workspaceId,
        created_by: user.id,
        name: goal.name,
        goal_type: goal.goalType,
        target_amount: goal.targetAmount,
        target_date: goal.targetDate ?? null,
        visibility: "shared",
        emoji: GOAL_EMOJI[goal.goalType],
      });
      if (error) return { error: GENERIC_ERROR };
      existing += 1;
      added += 1;
    }
  }

  if (added > 0) {
    const profile = await getProfileBasics(supabase, user.id);
    await logActivity(supabase, {
      workspaceId,
      actorId: user.id,
      eventType: "goal.created",
      summary: `${profile.name} added ${added} shared goal${
        added === 1 ? "" : "s"
      } during setup`,
      entityType: "goal",
      visibility: "shared",
    });
    await notifyPartner(supabase, {
      workspaceId,
      actorId: user.id,
      type: "goal.created",
      title: `${profile.name} added ${added} shared goal${
        added === 1 ? "" : "s"
      }`,
      body: "Take a look when you have a moment — dreaming works better as a duo.",
      link: ROUTES.goals,
    });
  }

  await advanceStep(supabase, user.id, 10);
  if (skipped > 0) {
    return {
      warning: `Your current plan includes up to 3 savings goals, so we saved the first ${added}. The rest will be easy to add later — no rush.`,
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Step 10 — risk & priorities, then finish
// ---------------------------------------------------------------------------

export async function finishOnboardingAction(
  input: FinishStepPayload
): Promise<{ error?: string }> {
  const parsed = finishStepPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  const membership = await getMembership(supabase, user.id);
  if (!membership) return { error: NO_WORKSPACE_ERROR };

  const { error } = await supabase
    .from("profiles")
    .update({
      risk_comfort: parsed.data.riskComfort,
      financial_stress_notes: parsed.data.stressNotes?.trim()
        ? parsed.data.stressNotes.trim()
        : null,
      priorities: parsed.data.priorities,
      onboarding_step: TOTAL_STEPS,
      onboarding_complete: true,
    })
    .eq("id", user.id);
  if (error) return { error: GENERIC_ERROR };

  const profile = await getProfileBasics(supabase, user.id);
  await logActivity(supabase, {
    workspaceId: membership.workspace_id,
    actorId: user.id,
    eventType: "member.onboarded",
    summary: `${profile.name} finished setting up their profile`,
    entityType: "workspace",
    entityId: membership.workspace_id,
    visibility: "shared",
  });
  await notifyPartner(supabase, {
    workspaceId: membership.workspace_id,
    actorId: user.id,
    type: "member.onboarded",
    title: `${profile.name} finished setting up`,
    body: "You're both in — time to start planning together.",
    link: ROUTES.dashboard,
  });

  return {};
}

// ---------------------------------------------------------------------------
// Skip / continue without new data
// ---------------------------------------------------------------------------

export async function skipStepAction(
  input: SkipStepInput
): Promise<{ error?: string }> {
  const parsed = skipStepSchema.safeParse(input);
  if (!parsed.success || !SKIPPABLE_STEPS.has(parsed.data.step)) {
    return { error: GENERIC_ERROR };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: SESSION_ERROR };

  // Continuing past the workspace/invite steps only makes sense once a
  // workspace actually exists.
  if (parsed.data.step >= 1) {
    const membership = await getMembership(supabase, user.id);
    if (!membership) return { error: NO_WORKSPACE_ERROR };
  }

  await advanceStep(supabase, user.id, parsed.data.step + 1);
  return {};
}
