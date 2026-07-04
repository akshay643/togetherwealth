/**
 * Pure insight/analytics helpers for TogetherWealth.
 *
 * Everything in this file is a pure function: no DB calls, no side effects.
 * Callers (Server Components / actions) fetch rows — already visibility
 * filtered for the current user — and pass them in.
 *
 * All money values are dollars. Rates are ratios (0.12 = 12%) so they plug
 * straight into formatPercent.
 */

import { addDays, addMonths, differenceInCalendarMonths } from "date-fns";
import {
  EXPENSE_CATEGORY_LABELS,
  toMonthlyAmount,
  type ExpenseCategory,
  type RecurrenceFrequency,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import type {
  Budget,
  Debt,
  Expense,
  GoalWithContributions,
  IncomeSource,
  InvestmentWithHoldings,
  Profile,
  SavingsGoal,
} from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Small date helpers (local-time safe for `yyyy-MM-dd` strings)
// ---------------------------------------------------------------------------

/** Parse a `yyyy-MM-dd` (or ISO) string as a LOCAL date, avoiding UTC shifts. */
function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function startOfDayLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `yyyy-MM` key for grouping by calendar month. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Expenses whose expense_date falls in the given `yyyy-MM` month. */
export function expensesInMonth(expenses: Expense[], monthKey: string): Expense[] {
  return expenses.filter((e) => e.expense_date.slice(0, 7) === monthKey);
}

// ---------------------------------------------------------------------------
// Core computations
// ---------------------------------------------------------------------------

/**
 * Sum active income sources, normalized to monthly amounts.
 *
 * When `forUserVisible` is provided, private sources belonging to that user
 * are included; other users' private sources are always excluded (defense in
 * depth on top of RLS). Without it, only shared/household sources count.
 */
export function computeMonthlyIncome(
  incomeSources: IncomeSource[],
  forUserVisible?: string
): number {
  return incomeSources
    .filter((s) => s.is_active)
    .filter(
      (s) =>
        s.visibility !== "private" ||
        (forUserVisible !== undefined && s.owner_id === forUserVisible)
    )
    .reduce((sum, s) => sum + toMonthlyAmount(s.amount, s.frequency), 0);
}

/** Total of the given expenses (callers pass one month's worth). */
export function computeMonthlyExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Savings rate as a ratio of income: (income − expenses) / income.
 * Returns 0 when income is 0. Clamped to [-1, 1] so extreme months
 * don't produce silly numbers.
 */
export function computeSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  const rate = (income - expenses) / income;
  return Math.min(1, Math.max(-1, rate));
}

/** Categories treated as "essentials" for emergency-fund coverage. */
export const ESSENTIAL_EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "housing",
  "utilities",
  "groceries",
  "insurance",
  "transport",
  "debt_payment",
] as const;

/**
 * Average monthly essential spend from a multi-month expense window
 * (default: the dashboard's 90-day / 3-month window).
 */
export function computeEssentialMonthlySpend(
  expenses: Expense[],
  windowMonths = 3
): number {
  if (windowMonths <= 0) return 0;
  const total = expenses
    .filter((e) =>
      ESSENTIAL_EXPENSE_CATEGORIES.includes(e.category)
    )
    .reduce((sum, e) => sum + e.amount, 0);
  return total / windowMonths;
}

/** Months of essential expenses an emergency fund balance covers. */
export function computeEmergencyCoverageMonths(
  emergencyFundBalance: number,
  monthlyEssentialExpenses: number
): number {
  if (monthlyEssentialExpenses <= 0) return 0;
  return Math.max(0, emergencyFundBalance / monthlyEssentialExpenses);
}

/**
 * Monthly contribution needed to hit a goal's target by its target date.
 * Returns 0 when the goal is already funded, null when it has no target date.
 * A past-due target date is treated as "one month left" (i.e. the remainder).
 */
export function computeGoalMonthlyNeeded(
  goal: Pick<SavingsGoal, "target_amount" | "target_date">,
  contributedTotal: number,
  today: Date = new Date()
): number | null {
  const remaining = Math.max(0, goal.target_amount - contributedTotal);
  if (remaining === 0) return 0;
  if (!goal.target_date) return null;
  const monthsLeft = Math.max(
    1,
    differenceInCalendarMonths(parseDateOnly(goal.target_date), today)
  );
  return remaining / monthsLeft;
}

/** Spend recorded against a budget's category (and owner, for personal budgets). */
export function budgetSpent(budget: Budget, monthExpenses: Expense[]): number {
  return monthExpenses
    .filter((e) => e.category === budget.category)
    .filter((e) =>
      budget.scope === "personal" && budget.owner_id
        ? e.paid_by === budget.owner_id
        : true
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

// ---------------------------------------------------------------------------
// Upcoming bills (recurring expenses + debt due days)
// ---------------------------------------------------------------------------

export interface UpcomingBill {
  id: string;
  label: string;
  amount: number;
  dueDate: Date;
  source: "expense" | "debt";
}

/**
 * Next occurrence of a recurring item on/after `from`, projected from its
 * last recorded date. Returns null if the schedule can't be projected.
 */
export function nextRecurringDate(
  startDate: string,
  frequency: RecurrenceFrequency,
  from: Date
): Date | null {
  let d = parseDateOnly(startDate);
  const floor = startOfDayLocal(from);
  for (let i = 0; i < 1200 && d < floor; i++) {
    switch (frequency) {
      case "weekly":
        d = addDays(d, 7);
        break;
      case "biweekly":
        d = addDays(d, 14);
        break;
      case "monthly":
        d = addMonths(d, 1);
        break;
      case "quarterly":
        d = addMonths(d, 3);
        break;
      case "annual":
        d = addMonths(d, 12);
        break;
    }
  }
  return d >= floor ? d : null;
}

/** Next calendar date matching a debt's due day (clamped to month length). */
function nextDueDay(dueDay: number, from: Date): Date {
  const floor = startOfDayLocal(from);
  const clampedDay = (year: number, month: number) =>
    Math.min(dueDay, new Date(year, month + 1, 0).getDate());
  let candidate = new Date(
    floor.getFullYear(),
    floor.getMonth(),
    clampedDay(floor.getFullYear(), floor.getMonth())
  );
  if (candidate < floor) {
    candidate = new Date(
      floor.getFullYear(),
      floor.getMonth() + 1,
      clampedDay(floor.getFullYear(), floor.getMonth() + 1)
    );
  }
  return candidate;
}

/**
 * Bills due within the horizon: recurring expenses (deduped by
 * description + cadence, keeping the most recent occurrence) plus active
 * debts' minimum payments by due day. Sorted soonest first.
 */
export function computeUpcomingBills(
  expenses: Expense[],
  debts: Debt[],
  opts: { from?: Date; horizonDays?: number } = {}
): UpcomingBill[] {
  const from = opts.from ?? new Date();
  const horizon = addDays(startOfDayLocal(from), opts.horizonDays ?? 14);
  const bills: UpcomingBill[] = [];

  const recurring = new Map<string, Expense>();
  for (const e of expenses) {
    if (!e.is_recurring || !e.recurrence) continue;
    const key = `${e.description.trim().toLowerCase()}|${e.recurrence}`;
    const prev = recurring.get(key);
    if (!prev || e.expense_date > prev.expense_date) recurring.set(key, e);
  }
  for (const e of recurring.values()) {
    if (!e.recurrence) continue;
    const next = nextRecurringDate(e.expense_date, e.recurrence, from);
    if (next && next <= horizon) {
      bills.push({
        id: `expense-${e.id}`,
        label: e.description,
        amount: e.amount,
        dueDate: next,
        source: "expense",
      });
    }
  }

  for (const d of debts) {
    if (d.status !== "active" || !d.due_day || d.minimum_payment <= 0) continue;
    const next = nextDueDay(d.due_day, from);
    if (next <= horizon) {
      bills.push({
        id: `debt-${d.id}`,
        label: `${d.name} payment`,
        amount: d.minimum_payment,
        dueDate: next,
        source: "debt",
      });
    }
  }

  return bills.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// ---------------------------------------------------------------------------
// Debt payoff simulation (avalanche vs snowball)
// ---------------------------------------------------------------------------

export interface DebtPayoffResult {
  months: number;
  totalInterest: number;
  /** false when the cap was hit before every balance reached zero. */
  completed: boolean;
}

/**
 * Simple month-by-month payoff simulation.
 *
 * Assumptions: interest accrues monthly at apr/12; every debt gets its
 * minimum payment; `extraMonthly` (plus the minimums freed up by paid-off
 * debts) goes to the priority debt — highest APR for avalanche, smallest
 * balance for snowball. Capped at `capMonths`.
 */
export function simulateDebtPayoff(
  debts: Pick<Debt, "balance" | "apr" | "minimum_payment">[],
  strategy: "avalanche" | "snowball",
  extraMonthly = 200,
  capMonths = 600
): DebtPayoffResult {
  const working = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ balance: d.balance, apr: d.apr, min: d.minimum_payment }));
  if (working.length === 0) {
    return { months: 0, totalInterest: 0, completed: true };
  }

  // Freed-up minimums stay in the budget and roll forward.
  const monthlyBudget = working.reduce((s, d) => s + d.min, 0) + extraMonthly;
  let totalInterest = 0;
  let months = 0;

  const EPSILON = 0.005;
  while (working.some((d) => d.balance > EPSILON) && months < capMonths) {
    months++;

    for (const d of working) {
      if (d.balance <= EPSILON) continue;
      const interest = (d.balance * (d.apr / 100)) / 12;
      d.balance += interest;
      totalInterest += interest;
    }

    let available = monthlyBudget;
    for (const d of working) {
      if (d.balance <= EPSILON || available <= 0) continue;
      const pay = Math.min(d.min, d.balance, available);
      d.balance -= pay;
      available -= pay;
    }

    const priority = working
      .filter((d) => d.balance > EPSILON)
      .sort((a, b) =>
        strategy === "avalanche"
          ? b.apr - a.apr || a.balance - b.balance
          : a.balance - b.balance || b.apr - a.apr
      );
    for (const d of priority) {
      if (available <= 0) break;
      const pay = Math.min(available, d.balance);
      d.balance -= pay;
      available -= pay;
    }
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    completed: working.every((d) => d.balance <= EPSILON),
  };
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export type InsightTone = "positive" | "neutral" | "attention";

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: InsightTone;
  /** Plain-language description of how the number was computed. */
  assumption: string;
}

export interface InsightContext {
  profile: Profile;
  partnerProfile: Profile | null;
  /** All rows already visibility-filtered for the current user. */
  incomeSources: IncomeSource[];
  /** Roughly the last 90 days of expenses. */
  expenses: Expense[];
  /** Current-month budgets. */
  budgets: Budget[];
  goals: GoalWithContributions[];
  debts: Debt[];
  investments: InvestmentWithHoldings[];
  /** Injectable for tests; defaults to now. */
  today?: Date;
}

const DEBT_EXTRA_PAYMENT_ASSUMPTION = 200;
const DEBT_SIM_CAP_MONTHS = 600;

function contributedTotal(goal: GoalWithContributions): number {
  return goal.goal_contributions.reduce((sum, c) => sum + c.amount, 0);
}

function roundAbout(value: number): number {
  const step = value >= 1000 ? 50 : 10;
  return Math.round(value / step) * step;
}

function formatMonthsShort(months: number): string {
  const rounded = Math.round(months * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Build the educational insights list. Order: attention first, then
 * positive, then neutral — stable within each tone. Every insight carries
 * an `assumption` explaining the math in plain language.
 */
export function buildInsights(ctx: InsightContext): Insight[] {
  const today = ctx.today ?? new Date();
  const currency = ctx.profile.currency || "USD";
  const insights: Insight[] = [];

  const currentKey = monthKeyOf(today);
  const priorKey = monthKeyOf(
    new Date(today.getFullYear(), today.getMonth() - 1, 1)
  );
  const thisMonthExpenses = expensesInMonth(ctx.expenses, currentKey);
  const priorMonthExpenses = expensesInMonth(ctx.expenses, priorKey);

  // 1. Savings rate ---------------------------------------------------------
  const monthlyIncome = computeMonthlyIncome(ctx.incomeSources, ctx.profile.id);
  const monthlySpend = computeMonthlyExpenses(thisMonthExpenses);
  if (monthlyIncome > 0) {
    const rate = computeSavingsRate(monthlyIncome, monthlySpend);
    const assumption = `Income counts active shared and household sources plus your own private ones, normalized to monthly (${formatCurrency(monthlyIncome, { currency })}/mo). Spending counts visible expenses dated this calendar month (${formatCurrency(monthlySpend, { currency })} so far).`;
    if (rate < 0) {
      insights.push({
        id: "savings-rate",
        title: "Spending is ahead of income this month",
        body: `Recorded spending is about ${formatCurrency(monthlySpend - monthlyIncome, { currency })} more than a month of combined visible income. Months like this happen — it may be worth a calm look together.`,
        tone: "attention",
        assumption,
      });
    } else {
      insights.push({
        id: "savings-rate",
        title:
          rate >= 0.15 ? "A healthy savings rate" : "Your savings rate this month",
        body: `You're saving about ${formatPercent(rate)} of your combined visible income this month.`,
        tone: rate >= 0.15 ? "positive" : "neutral",
        assumption,
      });
    }
  }

  // 2. Emergency coverage ---------------------------------------------------
  const emergencyGoals = ctx.goals.filter(
    (g) => g.goal_type === "emergency_fund"
  );
  const emergencyBalance = emergencyGoals.reduce(
    (sum, g) => sum + contributedTotal(g),
    0
  );
  const essentialsMonthly = computeEssentialMonthlySpend(ctx.expenses, 3);
  if (emergencyGoals.length > 0 && essentialsMonthly > 0) {
    const months = computeEmergencyCoverageMonths(
      emergencyBalance,
      essentialsMonthly
    );
    insights.push({
      id: "emergency-coverage",
      title: "Emergency fund coverage",
      body:
        months >= 1
          ? `Your emergency fund covers about ${formatMonthsShort(months)} months of essentials.`
          : `Your emergency fund covers under a month of essentials so far — every contribution builds the cushion.`,
      tone: months >= 3 ? "positive" : months >= 1 ? "neutral" : "attention",
      assumption: `Essentials = housing, utilities, groceries, insurance, transport, and debt payments, averaged over the last 3 months (${formatCurrency(essentialsMonthly, { currency })}/mo). Fund balance = contributions to your emergency fund goal${emergencyGoals.length > 1 ? "s" : ""} (${formatCurrency(emergencyBalance, { currency })}).`,
    });
  }

  // 3. Budget watch ---------------------------------------------------------
  if (ctx.budgets.length > 0) {
    const over = ctx.budgets.filter(
      (b) => budgetSpent(b, thisMonthExpenses) > b.amount
    );
    if (over.length > 0) {
      const names = over
        .slice(0, 2)
        .map((b) => EXPENSE_CATEGORY_LABELS[b.category].toLowerCase())
        .join(" and ");
      insights.push({
        id: "budget-watch",
        title: `${over.length} of ${ctx.budgets.length} budgets are above plan this month`,
        body: `Spending was higher than planned in ${names}${over.length > 2 ? ", among others" : ""}. A small adjustment — or just a quick chat — usually does it.`,
        tone: "attention",
        assumption: `Compares visible expenses in each budget's category this calendar month against the amounts you planned for ${formatDate(`${currentKey}-01`)}.`,
      });
    } else {
      insights.push({
        id: "budget-watch",
        title: "Budgets are on plan",
        body: `All ${ctx.budgets.length} of this month's budgets are within plan so far.`,
        tone: "positive",
        assumption: `Compares visible expenses in each budget's category this calendar month against the amounts you planned.`,
      });
    }
  }

  // 4. Category trend -------------------------------------------------------
  {
    const byCategory = new Map<
      ExpenseCategory,
      { current: number; prior: number }
    >();
    for (const e of thisMonthExpenses) {
      const entry = byCategory.get(e.category) ?? { current: 0, prior: 0 };
      entry.current += e.amount;
      byCategory.set(e.category, entry);
    }
    for (const e of priorMonthExpenses) {
      const entry = byCategory.get(e.category) ?? { current: 0, prior: 0 };
      entry.prior += e.amount;
      byCategory.set(e.category, entry);
    }
    let biggest: {
      category: ExpenseCategory;
      diff: number;
      pct: number;
    } | null = null;
    for (const [category, { current, prior }] of byCategory) {
      if (prior <= 0) continue;
      const diff = current - prior;
      const pct = diff / prior;
      if (diff > 50 && pct > 0.2 && (!biggest || diff > biggest.diff)) {
        biggest = { category, diff, pct };
      }
    }
    if (biggest) {
      insights.push({
        id: "category-trend",
        title: `${EXPENSE_CATEGORY_LABELS[biggest.category]} spending is trending up`,
        body: `Spending on ${EXPENSE_CATEGORY_LABELS[biggest.category].toLowerCase()} is about ${Math.round(biggest.pct * 100)}% higher than the prior month — no judgment, just a pattern worth knowing about.`,
        tone: "neutral",
        assumption: `Compares this month's visible expenses in the category so far against the prior calendar month's total (a difference of about ${formatCurrency(roundAbout(biggest.diff), { currency })}). Only increases over 20% and ${formatCurrency(50, { currency })} are flagged.`,
      });
    }
  }

  // 5. Goal pace ------------------------------------------------------------
  {
    const candidate = ctx.goals
      .filter((g) => g.status === "active" && g.target_date)
      .map((g) => ({
        goal: g,
        contributed: contributedTotal(g),
      }))
      .filter(({ goal, contributed }) => goal.target_amount > contributed)
      .sort((a, b) =>
        (a.goal.target_date ?? "").localeCompare(b.goal.target_date ?? "")
      )[0];
    if (candidate) {
      const needed = computeGoalMonthlyNeeded(
        candidate.goal,
        candidate.contributed,
        today
      );
      if (needed !== null && needed > 0) {
        const planned = candidate.goal.monthly_contribution ?? 0;
        const onPace = planned >= needed;
        insights.push({
          id: "goal-pace",
          title: `Pace check: ${candidate.goal.name}`,
          body: `${candidate.goal.name} needs about ${formatCurrency(needed, { currency })}/mo to finish by ${formatDate(candidate.goal.target_date)}.${
            planned > 0
              ? onPace
                ? ` Your planned ${formatCurrency(planned, { currency })}/mo covers it.`
                : ` The current plan is ${formatCurrency(planned, { currency })}/mo — a bit under that pace.`
              : ""
          }`,
          tone: onPace && planned > 0 ? "positive" : "neutral",
          assumption: `${formatCurrency(candidate.contributed, { currency })} of ${formatCurrency(candidate.goal.target_amount, { currency })} contributed so far; the remainder is spread evenly over the months until ${formatDate(candidate.goal.target_date)}. Assumes steady monthly contributions.`,
        });
      }
    }
  }

  // 6. Debt strategy teaser -------------------------------------------------
  {
    const activeDebts = ctx.debts.filter(
      (d) => d.status === "active" && d.balance > 0
    );
    const distinctAprs = new Set(activeDebts.map((d) => d.apr));
    if (activeDebts.length >= 2 && distinctAprs.size >= 2) {
      const avalanche = simulateDebtPayoff(
        activeDebts,
        "avalanche",
        DEBT_EXTRA_PAYMENT_ASSUMPTION,
        DEBT_SIM_CAP_MONTHS
      );
      const snowball = simulateDebtPayoff(
        activeDebts,
        "snowball",
        DEBT_EXTRA_PAYMENT_ASSUMPTION,
        DEBT_SIM_CAP_MONTHS
      );
      const saved = snowball.totalInterest - avalanche.totalInterest;
      if (avalanche.completed && snowball.completed && saved >= 25) {
        insights.push({
          id: "debt-strategy",
          title: "Payoff order could save some interest",
          body: `Paying the highest-APR debt first (avalanche) could save about ${formatCurrency(roundAbout(saved), { currency })} in interest versus paying the smallest balance first (snowball).`,
          tone: "neutral",
          assumption: `Educational comparison only: assumes minimum payments continue, plus a shared extra ${formatCurrency(DEBT_EXTRA_PAYMENT_ASSUMPTION, { currency })}/mo; freed-up minimums roll into the next debt; APRs stay constant; horizon capped at ${DEBT_SIM_CAP_MONTHS} months.`,
        });
      }
    }
  }

  // 7. Risk alignment -------------------------------------------------------
  if (
    ctx.profile.risk_comfort !== null &&
    ctx.partnerProfile?.risk_comfort != null &&
    Math.abs(ctx.profile.risk_comfort - ctx.partnerProfile.risk_comfort) >= 2
  ) {
    insights.push({
      id: "risk-alignment",
      title: "Different risk comfort levels",
      body: "You and your partner have different risk comfort levels — a good topic for your next money check-in. Neither is wrong; a shared plan usually lands in between.",
      tone: "neutral",
      assumption: `Based on each partner's self-reported risk comfort (1 = very cautious, 5 = very comfortable): you ${ctx.profile.risk_comfort}, ${ctx.partnerProfile.full_name ?? "your partner"} ${ctx.partnerProfile.risk_comfort}.`,
    });
  }

  // 8. Upcoming bills -------------------------------------------------------
  {
    const bills = computeUpcomingBills(ctx.expenses, ctx.debts, {
      from: today,
      horizonDays: 14,
    });
    if (bills.length > 0) {
      const total = bills.reduce((sum, b) => sum + b.amount, 0);
      insights.push({
        id: "upcoming-bills",
        title: `${bills.length} ${bills.length === 1 ? "bill" : "bills"} due in the next two weeks`,
        body: `Upcoming recurring expenses and debt payments add up to about ${formatCurrency(total, { currency })} over the next 14 days.`,
        tone: "neutral",
        assumption:
          "Projected from your recurring expenses' schedules (based on their last recorded date) and active debts' due days with their minimum payments.",
      });
    }
  }

  const toneOrder: Record<InsightTone, number> = {
    attention: 0,
    positive: 1,
    neutral: 2,
  };
  return insights
    .map((insight, index) => ({ insight, index }))
    .sort(
      (a, b) =>
        toneOrder[a.insight.tone] - toneOrder[b.insight.tone] ||
        a.index - b.index
    )
    .map(({ insight }) => insight);
}
