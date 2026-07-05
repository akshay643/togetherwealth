import type { Metadata } from "next";
import Link from "next/link";
import { format, subDays } from "date-fns";
import {
  Banknote,
  ChartPie,
  HandCoins,
  Handshake,
  Landmark,
  MessagesSquare,
  NotebookPen,
  PiggyBank,
  ReceiptText,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ChartCard } from "@/components/shared/chart-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import {
  ASSET_CLASS_LABELS,
  EXPENSE_CATEGORY_LABELS,
  ROUTES,
  type AssetClass,
  type Visibility,
} from "@/lib/constants";
import { getDemoRows } from "@/lib/demo-data";
import { requireWorkspace } from "@/lib/data/workspace";
import { formatCurrency, formatMonth, formatPercent, monthStart } from "@/lib/format";
import {
  budgetSpent,
  buildInsights,
  computeEmergencyCoverageMonths,
  computeEssentialMonthlySpend,
  computeMonthlyExpenses,
  computeMonthlyIncome,
  computeSavingsRate,
  computeUpcomingBills,
  expensesInMonth,
  monthKeyOf,
} from "@/lib/insights";
import { hasCheckins } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  BillPayment,
  Debt,
  GoalWithContributions,
  InvestmentWithHoldings,
  Profile,
} from "@/lib/types/database";

import { ActivityFeed } from "./_components/activity-feed";
import { AllocationDonut, type AllocationSlice } from "./_components/allocation-donut";
import { BudgetSnapshot } from "./_components/budget-snapshot";
import { DebtOverview } from "./_components/debt-overview";
import { EmergencyFund } from "./_components/emergency-fund";
import { GoalProgress, type GoalProgressRow } from "./_components/goal-progress";
import { InsightsPanel } from "./_components/insights-panel";
import { NextActions, type NextAction } from "./_components/next-actions";
import { OpenTasks } from "./_components/open-tasks";
import { PendingApprovals } from "./_components/pending-approvals";
import { UpcomingBills } from "./_components/upcoming-bills";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Defense in depth on top of RLS: drop the partner's private rows. */
function keepVisible<T extends { visibility: Visibility }>(
  rows: T[] | null,
  ownerOf: (row: T) => string,
  userId: string
): T[] {
  return (rows ?? []).filter(
    (row) => row.visibility !== "private" || ownerOf(row) === userId
  );
}

function holdingsValue(investment: InvestmentWithHoldings): number {
  return investment.investment_holdings.reduce(
    (sum, h) => sum + h.current_value,
    0
  );
}

function netWorthOf(
  accounts: Account[],
  investments: InvestmentWithHoldings[],
  debts: Debt[]
): number {
  const assets =
    accounts.reduce((sum, a) => sum + a.balance, 0) +
    investments.reduce((sum, i) => sum + holdingsValue(i), 0);
  const liabilities = debts.reduce((sum, d) => sum + d.balance, 0);
  return assets - liabilities;
}

export default async function DashboardPage() {
  const ctx = await requireWorkspace();
  const supabase = await createClient();

  const me = ctx.user.id;
  const wsId = ctx.workspace.id;
  const currency = ctx.workspace.currency || ctx.profile.currency || "USD";
  const today = new Date();
  const monthStartStr = monthStart(today);
  const sinceStr = format(subDays(today, 90), "yyyy-MM-dd");

  let accountRows;
  let incomeRows;
  let expenseRows;
  let budgetRows;
  let goalRows;
  let investmentRows;
  let debtRows;
  let eventRows;
  let taskRows;
  let approvalRows;
  let checkinRows;
  let billPaymentRows: BillPayment[] | null | undefined;

  if (ctx.isDemo) {
    const demoRows = getDemoRows();
    accountRows = demoRows.accounts;
    incomeRows = demoRows.incomeSources.filter((row) => row.is_active);
    expenseRows = demoRows.expenses.filter((row) => row.expense_date >= sinceStr);
    budgetRows = demoRows.budgets.filter((row) => row.month === monthStartStr);
    goalRows = demoRows.goals.filter((row) => row.status === "active");
    investmentRows = demoRows.investments;
    debtRows = demoRows.debts.filter((row) => row.status === "active");
    eventRows = demoRows.events.slice(0, 8);
    taskRows = demoRows.tasks
      .filter((row) => row.assigned_to === me && row.status !== "done")
      .slice(0, 6);
    approvalRows = demoRows.approvals.filter((row) => row.status === "pending");
    checkinRows = demoRows.checkins
      .filter((row) => row.month === monthStartStr)
      .map((row) => ({ id: row.id }));
    billPaymentRows = demoRows.billPayments;
  } else {
    [
      { data: accountRows },
      { data: incomeRows },
      { data: expenseRows },
      { data: budgetRows },
      { data: goalRows },
      { data: investmentRows },
      { data: debtRows },
      { data: eventRows },
      { data: taskRows },
      { data: approvalRows },
      { data: checkinRows },
      { data: billPaymentRows },
    ] = await Promise.all([
      supabase.from("accounts").select("*").eq("workspace_id", wsId),
      supabase
        .from("income_sources")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("is_active", true),
      supabase
        .from("expenses")
        .select("*")
        .eq("workspace_id", wsId)
        .gte("expense_date", sinceStr)
        .order("expense_date", { ascending: false }),
      supabase
        .from("budgets")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("month", monthStartStr),
      supabase
        .from("savings_goals")
        .select("*, goal_contributions(*)")
        .eq("workspace_id", wsId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("investments")
        .select("*, investment_holdings(*)")
        .eq("workspace_id", wsId),
      supabase
        .from("debts")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("status", "active"),
      supabase
        .from("activity_events")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("assigned_to", me)
        .neq("status", "done")
        .order("due_on", { ascending: true, nullsFirst: false })
        .limit(6),
      supabase
        .from("approvals")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("money_checkins")
        .select("id")
        .eq("workspace_id", wsId)
        .eq("month", monthStartStr)
        .limit(1),
      supabase
        .from("bill_payments")
        .select("*")
        .eq("workspace_id", wsId),
    ]);
  }

  // ---- Visibility filtering (defensive, RLS already enforces) --------------
  const accounts = keepVisible(accountRows, (a) => a.owner_id, me);
  const incomeSources = keepVisible(incomeRows, (s) => s.owner_id, me);
  const expenses = keepVisible(expenseRows, (e) => e.created_by, me);
  const budgets = keepVisible(budgetRows, (b) => b.owner_id ?? "", me);
  const goals = keepVisible(
    (goalRows ?? []) as unknown as GoalWithContributions[],
    (g) => g.created_by,
    me
  );
  const investments = keepVisible(
    (investmentRows ?? []) as unknown as InvestmentWithHoldings[],
    (i) => i.owner_id,
    me
  );
  const debts = keepVisible(debtRows, (d) => d.owner_id, me);
  const events = (eventRows ?? []).filter(
    (e) => e.visibility !== "private" || e.actor_id === me
  );
  const tasks = taskRows ?? [];
  const pendingForMe = (approvalRows ?? []).filter(
    (a) => a.requested_by !== me
  );

  // ---- Aggregates -----------------------------------------------------------
  const ownedInvestments = investments.filter((i) => !i.is_watchlist);
  const isShared = <T extends { visibility: Visibility }>(row: T) =>
    row.visibility !== "private";

  const sharedNetWorth = netWorthOf(
    accounts.filter(isShared),
    ownedInvestments.filter(isShared),
    debts.filter(isShared)
  );
  const personalNetWorth = netWorthOf(accounts, ownedInvestments, debts);
  const partner = ctx.partner;
  const partnerNetWorth =
    partner && partner.share_personal_net_worth
      ? netWorthOf(
          accounts.filter((a) => a.owner_id === partner.id),
          ownedInvestments.filter((i) => i.owner_id === partner.id),
          debts.filter((d) => d.owner_id === partner.id)
        )
      : null;

  const currentKey = monthKeyOf(today);
  const priorKey = monthKeyOf(
    new Date(today.getFullYear(), today.getMonth() - 1, 1)
  );
  const thisMonthExpenses = expensesInMonth(expenses, currentKey);
  const priorMonthExpenses = expensesInMonth(expenses, priorKey);

  const monthlyIncome = computeMonthlyIncome(incomeSources, me);
  const monthlySpend = computeMonthlyExpenses(thisMonthExpenses);
  const savingsRate = computeSavingsRate(monthlyIncome, monthlySpend);

  // Trend vs the same point last month, so partial months compare fairly.
  const dayOfMonth = today.getDate();
  const priorSamePointSpend = computeMonthlyExpenses(
    priorMonthExpenses.filter(
      (e) => Number(e.expense_date.slice(8, 10)) <= dayOfMonth
    )
  );
  let spendTrend: { value: string; direction: "up" | "down" | "flat" } | undefined;
  let rateTrend: { value: string; direction: "up" | "down" | "flat" } | undefined;
  if (priorSamePointSpend > 0) {
    const pct = (monthlySpend - priorSamePointSpend) / priorSamePointSpend;
    spendTrend = {
      value: `${pct >= 0 ? "+" : ""}${Math.round(pct * 100)}%`,
      direction: pct > 0.005 ? "up" : pct < -0.005 ? "down" : "flat",
    };
    if (monthlyIncome > 0) {
      const priorRate = computeSavingsRate(monthlyIncome, priorSamePointSpend);
      const diffPts = Math.round((savingsRate - priorRate) * 100);
      rateTrend = {
        value: `${diffPts >= 0 ? "+" : ""}${diffPts} pts`,
        direction: diffPts > 0 ? "up" : diffPts < 0 ? "down" : "flat",
      };
    }
  }

  const myPrivateIncomeCount = incomeSources.filter(
    (s) => s.visibility === "private"
  ).length;
  const myPrivateSpendCount = thisMonthExpenses.filter(
    (e) => e.visibility === "private"
  ).length;

  // ---- Emergency fund -------------------------------------------------------
  const emergencyGoals = goals.filter((g) => g.goal_type === "emergency_fund");
  const emergencyBalance = emergencyGoals.reduce(
    (sum, g) =>
      sum + g.goal_contributions.reduce((cSum, c) => cSum + c.amount, 0),
    0
  );
  const essentialsMonthly = computeEssentialMonthlySpend(expenses, 3);
  const coverageMonths = computeEmergencyCoverageMonths(
    emergencyBalance,
    essentialsMonthly
  );

  // ---- Budget snapshot ------------------------------------------------------
  const budgetRowsForWidget = budgets
    .map((b) => ({
      id: b.id,
      label: EXPENSE_CATEGORY_LABELS[b.category],
      spent: budgetSpent(b, thisMonthExpenses),
      budget: b.amount,
    }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 4);
  const overBudgetCount = budgets.filter(
    (b) => budgetSpent(b, thisMonthExpenses) > b.amount
  ).length;

  // ---- Upcoming bills & debts -----------------------------------------------
  const bills = computeUpcomingBills(expenses, debts, {
    from: today,
    horizonDays: 14,
    billPayments: billPaymentRows ?? [],
  });
  const totalDebtBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const nextDebtBill =
    computeUpcomingBills([], debts, { from: today, horizonDays: 45 })[0] ??
    null;

  // ---- Goals ----------------------------------------------------------------
  const goalWidgetRows: GoalProgressRow[] = [...goals]
    .sort((a, b) => (a.target_date ?? "9999-12-31").localeCompare(b.target_date ?? "9999-12-31"))
    .slice(0, 3)
    .map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      contributed: g.goal_contributions.reduce((sum, c) => sum + c.amount, 0),
      target: g.target_amount,
      targetDate: g.target_date,
      visibility: g.visibility,
      isMinePrivate: g.visibility === "private" && g.created_by === me,
    }));

  // ---- Investment allocation (visible, owned holdings only) ------------------
  const byClass = new Map<AssetClass, number>();
  for (const inv of ownedInvestments) {
    const value = holdingsValue(inv);
    if (value > 0) {
      byClass.set(inv.asset_class, (byClass.get(inv.asset_class) ?? 0) + value);
    }
  }
  const classEntries = [...byClass.entries()].sort((a, b) => b[1] - a[1]);
  let slices: AllocationSlice[];
  if (classEntries.length <= 5) {
    slices = classEntries.map(([key, value]) => ({
      key,
      label: ASSET_CLASS_LABELS[key],
      value,
    }));
  } else {
    // More classes than fixed hues: keep the top 4, fold the rest into Other.
    const top = classEntries.slice(0, 4);
    const restValue = classEntries.slice(4).reduce((sum, [, v]) => sum + v, 0);
    slices = top.map(([key, value]) => ({
      key,
      label: ASSET_CLASS_LABELS[key],
      value,
    }));
    const other = slices.find((s) => s.key === "other");
    if (other) other.value += restValue;
    else slices.push({ key: "other", label: "Other", value: restValue });
    slices.sort((a, b) => b.value - a.value);
  }

  // ---- Suggested next actions -----------------------------------------------
  const unsettledSplits = expenses.filter(
    (e) => e.split_method !== "none" && !e.is_settled
  );
  const actions: NextAction[] = [];
  if (budgets.length === 0) {
    actions.push({
      key: "create-budget",
      title: "Set this month's budgets",
      description: `No budgets yet for ${formatMonth(today)}.`,
      href: ROUTES.budgets,
      icon: NotebookPen,
    });
  }
  if (unsettledSplits.length > 0) {
    actions.push({
      key: "settle-up",
      title: "Settle up on shared expenses",
      description: `${unsettledSplits.length} split ${unsettledSplits.length === 1 ? "expense hasn't" : "expenses haven't"} been settled yet.`,
      href: ROUTES.expenses,
      icon: HandCoins,
    });
  }
  if (pendingForMe.length > 0) {
    actions.push({
      key: "review-approval",
      title: "Review your partner's request",
      description: `${pendingForMe.length} ${pendingForMe.length === 1 ? "change is" : "changes are"} waiting on your approval.`,
      href: "#pending-approvals",
      icon: Handshake,
    });
  }
  if ((checkinRows ?? []).length === 0 && hasCheckins(ctx.plan)) {
    actions.push({
      key: "start-checkin",
      title: "Start your monthly check-in",
      description: `You haven't had a money check-in for ${formatMonth(today)} yet.`,
      href: ROUTES.checkins,
      icon: MessagesSquare,
    });
  }

  // ---- Insights ---------------------------------------------------------------
  const insights = buildInsights({
    profile: ctx.profile,
    partnerProfile: partner,
    incomeSources,
    expenses,
    budgets,
    goals,
    debts,
    investments,
    today,
  });

  // ---- Misc display bits ------------------------------------------------------
  const firstName = ctx.profile.full_name?.split(/\s+/)[0] ?? "there";
  const partnerFirstName = partner?.full_name?.split(/\s+/)[0] ?? "Your partner";
  const requesterNames: Record<string, string> = {};
  for (const member of ctx.members) {
    requesterNames[member.user_id] =
      member.profile.full_name ?? member.profile.email;
  }
  const profilesById: Record<
    string,
    Pick<Profile, "full_name" | "avatar_url" | "email">
  > = {};
  for (const member of ctx.members) {
    profilesById[member.user_id] = member.profile;
  }

  const netWorthHint = [
    `Your personal view: ${formatCurrency(personalNetWorth, { currency })} (includes your private items)`,
    partnerNetWorth !== null
      ? `${partnerFirstName} shares: ${formatCurrency(partnerNetWorth, { currency })}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      {pendingForMe.length > 0 ? (
        <PendingApprovals
          approvals={pendingForMe}
          currentUserId={me}
          requesterNames={requesterNames}
        />
      ) : null}

      <PageHeader
        title={`${greeting(today.getHours())}, ${firstName}`}
        description={`${ctx.workspace.name} · ${formatMonth(today)}`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Shared net worth"
          value={formatCurrency(sharedNetWorth, { currency })}
          icon={Landmark}
          hint={netWorthHint}
        />
        <StatCard
          label="Monthly income"
          value={formatCurrency(monthlyIncome, { currency })}
          icon={Banknote}
          hint={
            myPrivateIncomeCount > 0
              ? `Includes ${myPrivateIncomeCount} private ${myPrivateIncomeCount === 1 ? "source" : "sources"} of yours`
              : "Shared & household sources, normalized monthly"
          }
        />
        <StatCard
          label="Spending this month"
          value={formatCurrency(monthlySpend, { currency })}
          icon={ReceiptText}
          trend={spendTrend}
          hint={
            myPrivateSpendCount > 0
              ? `vs this point last month · includes ${myPrivateSpendCount} private ${myPrivateSpendCount === 1 ? "expense" : "expenses"} of yours`
              : "vs this point last month"
          }
        />
        <StatCard
          label="Savings rate"
          value={formatPercent(savingsRate)}
          icon={PiggyBank}
          trend={rateTrend}
          hint="Of combined visible income this month"
        />
      </div>

      <InsightsPanel insights={insights} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard
          title="Suggested next steps"
          description="Small things that keep the plan moving"
        >
          <NextActions actions={actions.slice(0, 4)} />
        </ChartCard>

        <ChartCard
          title="Emergency fund"
          description="Your cushion for surprises"
          action={
            emergencyGoals.length > 0 ? (
              <Button asChild variant="ghost" size="sm" className="max-md:h-11">
                <Link href={ROUTES.emergencyFund}>Details</Link>
              </Button>
            ) : undefined
          }
        >
          <EmergencyFund
            hasGoal={emergencyGoals.length > 0}
            balance={emergencyBalance}
            essentialsMonthly={essentialsMonthly}
            coverageMonths={coverageMonths}
            currency={currency}
          />
        </ChartCard>

        <ChartCard
          title="Budget snapshot"
          description={
            budgets.length > 0
              ? overBudgetCount > 0
                ? `${overBudgetCount} of ${budgets.length} above plan this month`
                : "All budgets within plan so far"
              : "Spending vs plan, at a glance"
          }
          action={
            budgets.length > 0 ? (
              <Button asChild variant="ghost" size="sm" className="max-md:h-11">
                <Link href={ROUTES.budgets}>View all</Link>
              </Button>
            ) : undefined
          }
        >
          <BudgetSnapshot rows={budgetRowsForWidget} currency={currency} />
        </ChartCard>

        <ChartCard
          title="Upcoming bills"
          description="Due in the next 14 days"
        >
          <UpcomingBills bills={bills} currency={currency} />
        </ChartCard>

        <ChartCard title="Debts" description="Active balances and what's next">
          <DebtOverview
            totalBalance={totalDebtBalance}
            debtCount={debts.length}
            nextPayment={
              nextDebtBill
                ? {
                    label: nextDebtBill.label,
                    amount: nextDebtBill.amount,
                    dueDate: nextDebtBill.dueDate,
                  }
                : null
            }
            currency={currency}
          />
        </ChartCard>

        <ChartCard
          title="Goal progress"
          description="Closest target dates first"
          action={
            goals.length > 0 ? (
              <Button asChild variant="ghost" size="sm" className="max-md:h-11">
                <Link href={ROUTES.goals}>View all</Link>
              </Button>
            ) : undefined
          }
        >
          <GoalProgress goals={goalWidgetRows} currency={currency} />
        </ChartCard>

        <ChartCard
          title="Investment mix"
          description="Visible holdings by asset class"
          action={
            slices.length > 0 ? (
              <Button asChild variant="ghost" size="sm" className="max-md:h-11">
                <Link href={ROUTES.investments}>Details</Link>
              </Button>
            ) : undefined
          }
        >
          {slices.length > 0 ? (
            <AllocationDonut slices={slices} currency={currency} />
          ) : (
            <EmptyState
              icon={ChartPie}
              title="No investments yet"
              description="Add holdings to see how your money is spread across asset classes."
              className="border-0 py-6 sm:py-8"
              action={
                <Button asChild variant="outline" size="sm" className="max-md:h-11">
                  <Link href={ROUTES.investments}>Add an investment</Link>
                </Button>
              }
            />
          )}
        </ChartCard>

        <ChartCard
          title="Your tasks"
          description="Assigned to you"
          action={
            <Button asChild variant="ghost" size="sm" className="max-md:h-11">
              <Link href={ROUTES.tasks}>View all</Link>
            </Button>
          }
        >
          <OpenTasks tasks={tasks} />
        </ChartCard>

        <ChartCard
          title="Recent activity"
          description="What you two have been up to"
          action={
            <Button asChild variant="ghost" size="sm" className="max-md:h-11">
              <Link href={ROUTES.activity}>View all</Link>
            </Button>
          }
        >
          <ActivityFeed events={events} profilesById={profilesById} />
        </ChartCard>
      </div>
    </div>
  );
}
