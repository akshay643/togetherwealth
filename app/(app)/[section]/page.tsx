import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Banknote,
  BookOpen,
  CalendarCheck,
  CheckSquare,
  CreditCard,
  FileText,
  Gem,
  Heart,
  Landmark,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCOUNT_TYPE_LABELS,
  ASSET_CLASS_LABELS,
  DECISION_TYPE_LABELS,
  DEBT_TYPE_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  GOAL_TYPE_LABELS,
  MONEY_STYLE_META,
  PLAN_META,
  SPLIT_METHOD_META,
  type Visibility,
} from "@/lib/constants";
import { requireWorkspace, type WorkspaceContext } from "@/lib/data/workspace";
import {
  formatCurrency,
  formatDate,
  formatMonth,
  formatPercent,
  monthStart,
} from "@/lib/format";
import { getDemoRows } from "@/lib/demo-data";
import {
  budgetSpent,
  computeEmergencyCoverageMonths,
  computeEssentialMonthlySpend,
  computeMonthlyExpenses,
  computeMonthlyIncome,
  computeSavingsRate,
  expensesInMonth,
  monthKeyOf,
  simulateDebtPayoff,
} from "@/lib/insights";
import { hasCheckins, hasResearchExport } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  ActivityEvent,
  Approval,
  Budget,
  Debt,
  DocumentRow,
  Expense,
  GoalWithContributions,
  IncomeSource,
  InvestmentHolding,
  InvestmentWithHoldings,
  MoneyCheckin,
  ResearchItem,
  Task,
} from "@/lib/types/database";
import {
  BudgetRowActions,
  DebtRowActions,
  ExpenseRowActions,
  GoalRowActions,
  SectionActions,
} from "./_components/section-actions";

const SECTIONS = {
  "net-worth": {
    title: "Net worth",
    description: "Assets, investments, and active debts in one place.",
    icon: Scale,
  },
  "cash-flow": {
    title: "Cash flow",
    description: "Income, spending, and savings rate for the current month.",
    icon: ArrowLeftRight,
  },
  activity: {
    title: "Activity",
    description: "Recent workspace changes and money moments.",
    icon: Activity,
  },
  expenses: {
    title: "Expenses",
    description: "Recent spending, recurring bills, and split status.",
    icon: Receipt,
  },
  budgets: {
    title: "Budgets",
    description: "This month's plan against recorded spending.",
    icon: Wallet,
  },
  debts: {
    title: "Debts",
    description: "Active balances, minimums, and payoff strategy.",
    icon: CreditCard,
  },
  "emergency-fund": {
    title: "Emergency fund",
    description: "Your cash cushion measured against essential spending.",
    icon: ShieldCheck,
  },
  goals: {
    title: "Goals",
    description: "Savings targets, progress, and monthly pace.",
    icon: Target,
  },
  "couple-goals": {
    title: "Couple goals",
    description: "Shared and household goals you can plan together.",
    icon: Heart,
  },
  investments: {
    title: "Investments",
    description: "Holdings, watchlist items, and allocation by asset class.",
    icon: TrendingUp,
  },
  research: {
    title: "Research",
    description: "Open money decisions, notes, pros, and cons.",
    icon: BookOpen,
  },
  "check-ins": {
    title: "Check-ins",
    description: "Monthly money conversations and follow-up actions.",
    icon: CalendarCheck,
  },
  documents: {
    title: "Documents",
    description: "Shared records, reminders, and expiry dates.",
    icon: FileText,
  },
  tasks: {
    title: "Tasks",
    description: "Open follow-ups for your household plan.",
    icon: CheckSquare,
  },
  settings: {
    title: "Settings",
    description: "Workspace, members, privacy, and planning defaults.",
    icon: Settings,
  },
  billing: {
    title: "Billing",
    description: "Current subscription and plan limits.",
    icon: Gem,
  },
  admin: {
    title: "Admin",
    description: "Workspace health snapshot for platform admins.",
    icon: ShieldAlert,
  },
} as const satisfies Record<
  string,
  { title: string; description: string; icon: LucideIcon }
>;

type SectionSlug = keyof typeof SECTIONS;

type SectionRows = {
  accounts: Account[];
  incomeSources: IncomeSource[];
  expenses: Expense[];
  budgets: Budget[];
  goals: GoalWithContributions[];
  investments: InvestmentWithHoldings[];
  debts: Debt[];
  researchItems: ResearchItem[];
  checkins: MoneyCheckin[];
  documents: DocumentRow[];
  tasks: Task[];
  events: ActivityEvent[];
  approvals: Approval[];
};

type SectionData = SectionRows & {
  ctx: WorkspaceContext;
  me: string;
  currency: string;
  today: Date;
  currentMonthKey: string;
  currentMonthStart: string;
};

export async function generateMetadata(props: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await props.params;
  const meta = SECTIONS[section as SectionSlug];
  return { title: meta?.title ?? "Not found" };
}

function getSection(section: string): SectionSlug {
  if (section in SECTIONS) return section as SectionSlug;
  notFound();
}

function keepVisible<T extends { visibility: Visibility }>(
  rows: T[] | null,
  ownerOf: (row: T) => string | null,
  userId: string
): T[] {
  return (rows ?? []).filter(
    (row) => row.visibility !== "private" || ownerOf(row) === userId
  );
}

function holdingsValue(investment: InvestmentWithHoldings): number {
  return investment.investment_holdings.reduce(
    (sum, holding) => sum + holding.current_value,
    0
  );
}

function holdingsCost(investment: InvestmentWithHoldings): number {
  return investment.investment_holdings.reduce(
    (sum, holding) => sum + (holding.cost_basis ?? 0),
    0
  );
}

function contributedTotal(goal: GoalWithContributions): number {
  return goal.goal_contributions.reduce(
    (sum, contribution) => sum + contribution.amount,
    0
  );
}

function progressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function memberName(ctx: WorkspaceContext, id: string | null): string {
  if (!id) return "Unassigned";
  const member = ctx.members.find((row) => row.user_id === id);
  return member?.profile.full_name ?? member?.profile.email ?? "Partner";
}

function statusBadge(status: string) {
  return (
    <Badge variant="outline" className="capitalize text-muted-foreground">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function SimpleEmpty({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      className="border-0 py-8"
    />
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return <Table className="min-w-[720px]">{children}</Table>;
}

async function loadSectionData(ctx: WorkspaceContext): Promise<SectionData> {
  const me = ctx.user.id;
  const today = new Date();
  const currentMonthKey = monthKeyOf(today);
  const currentMonthStart = monthStart(today);

  if (ctx.isDemo) {
    return {
      ...getDemoRows(),
      ctx,
      me,
      currency: ctx.workspace.currency || ctx.profile.currency || "USD",
      today,
      currentMonthKey,
      currentMonthStart,
    };
  }

  const supabase = await createClient();
  const wsId = ctx.workspace.id;

  const [
    { data: accountRows },
    { data: incomeRows },
    { data: expenseRows },
    { data: budgetRows },
    { data: goalRows },
    { data: investmentRows },
    { data: debtRows },
    { data: researchRows },
    { data: checkinRows },
    { data: documentRows },
    { data: taskRows },
    { data: eventRows },
    { data: approvalRows },
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("workspace_id", wsId),
    supabase.from("income_sources").select("*").eq("workspace_id", wsId),
    supabase
      .from("expenses")
      .select("*")
      .eq("workspace_id", wsId)
      .order("expense_date", { ascending: false })
      .limit(100),
    supabase
      .from("budgets")
      .select("*")
      .eq("workspace_id", wsId)
      .order("month", { ascending: false })
      .order("category", { ascending: true }),
    supabase
      .from("savings_goals")
      .select("*, goal_contributions(*)")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false }),
    supabase
      .from("investments")
      .select("*, investment_holdings(*)")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false }),
    supabase
      .from("debts")
      .select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false }),
    supabase
      .from("research_items")
      .select("*")
      .eq("workspace_id", wsId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("money_checkins")
      .select("*")
      .eq("workspace_id", wsId)
      .order("month", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("workspace_id", wsId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", wsId)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_events")
      .select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("approvals")
      .select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    ctx,
    me,
    currency: ctx.workspace.currency || ctx.profile.currency || "USD",
    today,
    currentMonthKey,
    currentMonthStart,
    accounts: keepVisible(accountRows, (row) => row.owner_id, me),
    incomeSources: keepVisible(incomeRows, (row) => row.owner_id, me),
    expenses: keepVisible(expenseRows, (row) => row.created_by, me),
    budgets: keepVisible(budgetRows, (row) => row.owner_id, me),
    goals: keepVisible(
      (goalRows ?? []) as unknown as GoalWithContributions[],
      (row) => row.created_by,
      me
    ),
    investments: keepVisible(
      (investmentRows ?? []) as unknown as InvestmentWithHoldings[],
      (row) => row.owner_id,
      me
    ),
    debts: keepVisible(debtRows, (row) => row.owner_id, me),
    researchItems: keepVisible(researchRows, (row) => row.created_by, me),
    checkins: checkinRows ?? [],
    documents: keepVisible(documentRows, (row) => row.owner_id, me),
    tasks: taskRows ?? [],
    events: (eventRows ?? []).filter(
      (row) => row.visibility !== "private" || row.actor_id === me
    ),
    approvals: approvalRows ?? [],
  };
}

function renderNetWorth(data: SectionData) {
  const investmentValue = data.investments
    .filter((row) => !row.is_watchlist)
    .reduce((sum, row) => sum + holdingsValue(row), 0);
  const cashValue = data.accounts.reduce((sum, row) => sum + row.balance, 0);
  const debtValue = data.debts
    .filter((row) => row.status === "active")
    .reduce((sum, row) => sum + row.balance, 0);
  const netWorth = cashValue + investmentValue - debtValue;
  const assets = [
    ...data.accounts.map((row) => ({
      id: `account-${row.id}`,
      name: row.name,
      type: ACCOUNT_TYPE_LABELS[row.type],
      owner: memberName(data.ctx, row.owner_id),
      value: row.balance,
      visibility: row.visibility,
    })),
    ...data.investments
      .filter((row) => !row.is_watchlist)
      .map((row) => ({
        id: `investment-${row.id}`,
        name: row.name,
        type: ASSET_CLASS_LABELS[row.asset_class],
        owner: memberName(data.ctx, row.owner_id),
        value: holdingsValue(row),
        visibility: row.visibility,
      })),
  ].sort((a, b) => b.value - a.value);

  return (
    <>
      <MetricGrid>
        <StatCard label="Net worth" value={formatCurrency(netWorth, { currency: data.currency })} icon={Scale} />
        <StatCard label="Accounts" value={formatCurrency(cashValue, { currency: data.currency })} icon={Landmark} />
        <StatCard label="Investments" value={formatCurrency(investmentValue, { currency: data.currency })} icon={TrendingUp} />
        <StatCard label="Active debts" value={formatCurrency(debtValue, { currency: data.currency })} icon={CreditCard} />
      </MetricGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Assets">
          {assets.length > 0 ? (
            <DataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.owner}</TableCell>
                    <TableCell><VisibilityBadge visibility={row.visibility} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.value, { currency: data.currency })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <SimpleEmpty icon={Landmark} title="No assets yet" description="Accounts and investment holdings will appear here once added." />
          )}
        </SectionCard>
        <SectionCard title="Liabilities">
          {data.debts.length > 0 ? (
            <DataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>APR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.debts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{DEBT_TYPE_LABELS[row.debt_type]}</TableCell>
                    <TableCell>{row.apr.toFixed(2)}%</TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.balance, { currency: data.currency })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <SimpleEmpty icon={CreditCard} title="No debts tracked" description="Active debts will appear here when you add them." />
          )}
        </SectionCard>
      </div>
    </>
  );
}

function renderCashFlow(data: SectionData) {
  const monthExpenses = expensesInMonth(data.expenses, data.currentMonthKey);
  const income = computeMonthlyIncome(data.incomeSources, data.me);
  const spending = computeMonthlyExpenses(monthExpenses);
  const rate = computeSavingsRate(income, spending);
  const recurring = data.expenses.filter((row) => row.is_recurring);
  const byCategory = new Map<string, number>();
  for (const expense of monthExpenses) {
    byCategory.set(
      EXPENSE_CATEGORY_LABELS[expense.category],
      (byCategory.get(EXPENSE_CATEGORY_LABELS[expense.category]) ?? 0) +
        expense.amount
    );
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <MetricGrid>
        <StatCard label="Monthly income" value={formatCurrency(income, { currency: data.currency })} icon={Banknote} />
        <StatCard label="Spent this month" value={formatCurrency(spending, { currency: data.currency })} icon={Receipt} />
        <StatCard label="Savings rate" value={formatPercent(rate)} icon={PiggyBank} />
        <StatCard label="Recurring items" value={String(recurring.length)} icon={ArrowLeftRight} />
      </MetricGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Income sources">
          {data.incomeSources.length > 0 ? (
            <DataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.incomeSources.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="capitalize">{row.frequency}</TableCell>
                    <TableCell>{memberName(data.ctx, row.owner_id)}</TableCell>
                    <TableCell><VisibilityBadge visibility={row.visibility} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.amount, { currency: data.currency })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <SimpleEmpty icon={Banknote} title="No income yet" description="Income sources from onboarding or future entries will appear here." />
          )}
        </SectionCard>
        <SectionCard title="Spending by category">
          {categoryRows.length > 0 ? (
            <div className="space-y-3">
              {categoryRows.map(([label, amount]) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(amount, { currency: data.currency })}
                    </span>
                  </div>
                  <Progress value={progressPercent(amount, spending)} />
                </div>
              ))}
            </div>
          ) : (
            <SimpleEmpty icon={Receipt} title="No spending this month" description="Expenses dated this month will be grouped here." />
          )}
        </SectionCard>
      </div>
    </>
  );
}

function renderExpenses(data: SectionData) {
  const monthExpenses = expensesInMonth(data.expenses, data.currentMonthKey);
  const spending = computeMonthlyExpenses(monthExpenses);
  const recurring = data.expenses.filter((row) => row.is_recurring).length;
  const unsettled = data.expenses.filter(
    (row) => row.split_method !== "none" && !row.is_settled
  ).length;

  return (
    <>
      <MetricGrid>
        <StatCard label="This month" value={formatCurrency(spending, { currency: data.currency })} icon={Receipt} />
        <StatCard label="Expenses loaded" value={String(data.expenses.length)} icon={Wallet} />
        <StatCard label="Recurring" value={String(recurring)} icon={ArrowLeftRight} />
        <StatCard label="Unsettled splits" value={String(unsettled)} icon={Users} />
      </MetricGrid>
      <SectionCard title="Recent expenses">
        {data.expenses.length > 0 ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Paid by</TableHead>
                <TableHead>Split</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expenses.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.description}</TableCell>
                  <TableCell>{EXPENSE_CATEGORY_LABELS[row.category]}</TableCell>
                  <TableCell>{formatDate(row.expense_date)}</TableCell>
                  <TableCell>{memberName(data.ctx, row.paid_by)}</TableCell>
                  <TableCell>{SPLIT_METHOD_META[row.split_method].label}</TableCell>
                  <TableCell><VisibilityBadge visibility={row.visibility} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.amount, { currency: data.currency })}</TableCell>
                  <TableCell>
                    <ExpenseRowActions expense={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <SimpleEmpty icon={Receipt} title="No expenses yet" description="Spending entries will appear here once added." />
        )}
      </SectionCard>
    </>
  );
}

function renderBudgets(data: SectionData) {
  const monthExpenses = expensesInMonth(data.expenses, data.currentMonthKey);
  const currentBudgets = data.budgets.filter(
    (row) => row.month === data.currentMonthStart
  );
  const visibleBudgets = currentBudgets.length > 0 ? currentBudgets : data.budgets;
  const totalBudget = visibleBudgets.reduce((sum, row) => sum + row.amount, 0);
  const totalSpent = visibleBudgets.reduce(
    (sum, row) => sum + budgetSpent(row, monthExpenses),
    0
  );
  const overBudget = visibleBudgets.filter(
    (row) => budgetSpent(row, monthExpenses) > row.amount
  ).length;

  return (
    <>
      <MetricGrid>
        <StatCard label="Budgeted" value={formatCurrency(totalBudget, { currency: data.currency })} icon={Wallet} />
        <StatCard label="Spent" value={formatCurrency(totalSpent, { currency: data.currency })} icon={Receipt} />
        <StatCard label="Remaining" value={formatCurrency(totalBudget - totalSpent, { currency: data.currency })} icon={PiggyBank} />
        <StatCard label="Above plan" value={String(overBudget)} icon={ShieldAlert} />
      </MetricGrid>
      <SectionCard title={visibleBudgets === currentBudgets ? formatMonth(data.today) : "Budget history"}>
        {visibleBudgets.length > 0 ? (
          <div className="space-y-4">
            {visibleBudgets.map((row) => {
              const spent = budgetSpent(row, monthExpenses);
              return (
                <div key={row.id} className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{EXPENSE_CATEGORY_LABELS[row.category]}</p>
                      <p className="text-xs text-muted-foreground">
                        {titleCase(row.scope)} budget {row.owner_id ? `for ${memberName(data.ctx, row.owner_id)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right text-sm tabular-nums">
                      <p>{formatCurrency(spent, { currency: data.currency })} / {formatCurrency(row.amount, { currency: data.currency })}</p>
                      <div className="flex flex-wrap justify-end gap-1">
                        <VisibilityBadge visibility={row.visibility} />
                        <BudgetRowActions budget={row} />
                      </div>
                    </div>
                  </div>
                  <Progress value={progressPercent(spent, row.amount)} />
                </div>
              );
            })}
          </div>
        ) : (
          <SimpleEmpty icon={Wallet} title="No budgets yet" description="Monthly budget rows will appear here once created." />
        )}
      </SectionCard>
    </>
  );
}

function renderDebts(data: SectionData) {
  const activeDebts = data.debts.filter((row) => row.status === "active");
  const totalDebt = activeDebts.reduce((sum, row) => sum + row.balance, 0);
  const minimums = activeDebts.reduce(
    (sum, row) => sum + row.minimum_payment,
    0
  );
  const weightedApr =
    totalDebt > 0
      ? activeDebts.reduce((sum, row) => sum + row.apr * row.balance, 0) /
        totalDebt
      : 0;
  const avalanche = simulateDebtPayoff(activeDebts, "avalanche");
  const snowball = simulateDebtPayoff(activeDebts, "snowball");

  return (
    <>
      <MetricGrid>
        <StatCard label="Active balance" value={formatCurrency(totalDebt, { currency: data.currency })} icon={CreditCard} />
        <StatCard label="Monthly minimums" value={formatCurrency(minimums, { currency: data.currency })} icon={Wallet} />
        <StatCard label="Weighted APR" value={`${weightedApr.toFixed(2)}%`} icon={TrendingUp} />
        <StatCard label="Avalanche estimate" value={avalanche.completed ? `${avalanche.months} mo` : "Long range"} icon={Target} />
      </MetricGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Debt list">
          {data.debts.length > 0 ? (
            <DataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due day</TableHead>
                  <TableHead>APR</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.debts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{DEBT_TYPE_LABELS[row.debt_type]}</TableCell>
                    <TableCell>{row.due_day ? `Day ${row.due_day}` : "-"}</TableCell>
                    <TableCell>{row.apr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.minimum_payment, { currency: data.currency })}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.balance, { currency: data.currency })}</TableCell>
                    <TableCell>
                      <DebtRowActions debt={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <SimpleEmpty icon={CreditCard} title="No debts tracked" description="Debt balances and payoff details will appear here." />
          )}
        </SectionCard>
        <SectionCard title="Payoff comparison">
          {activeDebts.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Avalanche</p>
                  <p className="text-xs text-muted-foreground">Highest APR first, plus $200 extra monthly.</p>
                </div>
                <p className="text-right text-sm tabular-nums">
                  {avalanche.completed ? `${avalanche.months} months` : "Long range"}
                  <br />
                  <span className="text-muted-foreground">{formatCurrency(avalanche.totalInterest, { currency: data.currency })} interest</span>
                </p>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Snowball</p>
                  <p className="text-xs text-muted-foreground">Smallest balance first, plus $200 extra monthly.</p>
                </div>
                <p className="text-right text-sm tabular-nums">
                  {snowball.completed ? `${snowball.months} months` : "Long range"}
                  <br />
                  <span className="text-muted-foreground">{formatCurrency(snowball.totalInterest, { currency: data.currency })} interest</span>
                </p>
              </div>
            </div>
          ) : (
            <SimpleEmpty icon={Target} title="No payoff plan yet" description="Add active debts to compare strategies." />
          )}
        </SectionCard>
      </div>
    </>
  );
}

function renderEmergencyFund(data: SectionData) {
  const emergencyGoals = data.goals.filter(
    (row) => row.goal_type === "emergency_fund"
  );
  const balance = emergencyGoals.reduce(
    (sum, row) => sum + contributedTotal(row),
    0
  );
  const essentials = computeEssentialMonthlySpend(data.expenses, 3);
  const coverage = computeEmergencyCoverageMonths(balance, essentials);
  const target = emergencyGoals.reduce((sum, row) => sum + row.target_amount, 0);

  return (
    <>
      <MetricGrid>
        <StatCard label="Saved" value={formatCurrency(balance, { currency: data.currency })} icon={ShieldCheck} />
        <StatCard label="Target" value={formatCurrency(target, { currency: data.currency })} icon={Target} />
        <StatCard label="Essential spend" value={formatCurrency(essentials, { currency: data.currency })} icon={Receipt} />
        <StatCard label="Coverage" value={`${coverage.toFixed(1)} mo`} icon={PiggyBank} />
      </MetricGrid>
      <SectionCard title="Emergency goals">
        {emergencyGoals.length > 0 ? (
          <div className="space-y-4">
            {emergencyGoals.map((row) => {
              const saved = contributedTotal(row);
              return (
                <div key={row.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.emoji ? `${row.emoji} ` : ""}{row.name}</p>
                      <p className="text-xs text-muted-foreground">Target {formatDate(row.target_date)}</p>
                    </div>
                    <p className="text-right text-sm tabular-nums">{formatCurrency(saved, { currency: data.currency })} / {formatCurrency(row.target_amount, { currency: data.currency })}</p>
                  </div>
                  <Progress value={progressPercent(saved, row.target_amount)} />
                </div>
              );
            })}
          </div>
        ) : (
          <SimpleEmpty icon={ShieldCheck} title="No emergency fund yet" description="Emergency fund goals from onboarding or future entries will appear here." />
        )}
      </SectionCard>
    </>
  );
}

function renderGoals(data: SectionData, coupleOnly = false) {
  const goals = coupleOnly
    ? data.goals.filter((row) => row.visibility !== "private")
    : data.goals;
  const active = goals.filter((row) => row.status === "active");
  const target = goals.reduce((sum, row) => sum + row.target_amount, 0);
  const saved = goals.reduce((sum, row) => sum + contributedTotal(row), 0);

  return (
    <>
      <MetricGrid>
        <StatCard label="Goals" value={String(goals.length)} icon={Target} />
        <StatCard label="Active" value={String(active.length)} icon={CheckSquare} />
        <StatCard label="Saved" value={formatCurrency(saved, { currency: data.currency })} icon={PiggyBank} />
        <StatCard label="Target" value={formatCurrency(target, { currency: data.currency })} icon={Landmark} />
      </MetricGrid>
      <SectionCard title={coupleOnly ? "Shared goals" : "All goals"}>
        {goals.length > 0 ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Target date</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((row) => {
                const savedAmount = contributedTotal(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.emoji ? `${row.emoji} ` : ""}{row.name}</TableCell>
                    <TableCell>{GOAL_TYPE_LABELS[row.goal_type]}</TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell>{formatDate(row.target_date)}</TableCell>
                    <TableCell><VisibilityBadge visibility={row.visibility} /></TableCell>
                    <TableCell className="min-w-44 text-right">
                      <span className="text-xs tabular-nums">{formatCurrency(savedAmount, { currency: data.currency })} / {formatCurrency(row.target_amount, { currency: data.currency })}</span>
                      <Progress className="mt-1" value={progressPercent(savedAmount, row.target_amount)} />
                    </TableCell>
                    <TableCell>
                      <GoalRowActions goal={row} coupleOnly={coupleOnly} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        ) : (
          <SimpleEmpty icon={coupleOnly ? Heart : Target} title={coupleOnly ? "No shared goals yet" : "No goals yet"} description="Savings goals will appear here once created." />
        )}
      </SectionCard>
    </>
  );
}

function renderInvestments(data: SectionData) {
  const holdings = data.investments.flatMap((investment) =>
    investment.investment_holdings.map((holding) => ({ investment, holding }))
  );
  const totalValue = holdings.reduce(
    (sum, row) => sum + row.holding.current_value,
    0
  );
  const totalCost = data.investments.reduce(
    (sum, row) => sum + holdingsCost(row),
    0
  );
  const watchlist = data.investments.filter((row) => row.is_watchlist).length;
  const gain = totalValue - totalCost;

  return (
    <>
      <MetricGrid>
        <StatCard label="Current value" value={formatCurrency(totalValue, { currency: data.currency })} icon={TrendingUp} />
        <StatCard label="Cost basis" value={formatCurrency(totalCost, { currency: data.currency })} icon={Landmark} />
        <StatCard label="Unrealized gain" value={formatCurrency(gain, { currency: data.currency, showSign: true })} icon={PiggyBank} />
        <StatCard label="Watchlist" value={String(watchlist)} icon={BookOpen} />
      </MetricGrid>
      <SectionCard title="Holdings">
        {holdings.length > 0 ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Holding</TableHead>
                <TableHead>Investment</TableHead>
                <TableHead>Asset class</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>As of</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map(({ investment, holding }: { investment: InvestmentWithHoldings; holding: InvestmentHolding }) => (
                <TableRow key={holding.id}>
                  <TableCell className="font-medium">{holding.symbol ? `${holding.symbol} - ` : ""}{holding.name}</TableCell>
                  <TableCell>{investment.name}</TableCell>
                  <TableCell>{ASSET_CLASS_LABELS[investment.asset_class]}</TableCell>
                  <TableCell>{memberName(data.ctx, investment.owner_id)}</TableCell>
                  <TableCell>{formatDate(holding.as_of)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(holding.current_value, { currency: data.currency })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <SimpleEmpty icon={TrendingUp} title="No holdings yet" description="Investment holdings will appear here when added." />
        )}
      </SectionCard>
    </>
  );
}

function renderResearch(data: SectionData) {
  const open = data.researchItems.filter(
    (row) => row.status === "researching" || row.status === "discussing"
  );
  const decided = data.researchItems.filter((row) => row.status === "decided");

  return (
    <>
      <MetricGrid>
        <StatCard label="Open decisions" value={String(open.length)} icon={BookOpen} />
        <StatCard label="Decided" value={String(decided.length)} icon={CheckSquare} />
        <StatCard label="Research items" value={String(data.researchItems.length)} icon={FileText} />
        <StatCard label="Export" value={hasResearchExport(data.ctx.plan) ? "Included" : "Premium"} icon={Gem} />
      </MetricGrid>
      <SectionCard title="Decision research">
        {data.researchItems.length > 0 ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pros / cons</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Estimated cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.researchItems.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-72 whitespace-normal font-medium">{row.title}</TableCell>
                  <TableCell>{DECISION_TYPE_LABELS[row.decision_type]}</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                  <TableCell>{row.pros.length} / {row.cons.length}</TableCell>
                  <TableCell><VisibilityBadge visibility={row.visibility} /></TableCell>
                  <TableCell className="text-right tabular-nums">{row.estimated_cost ? formatCurrency(row.estimated_cost, { currency: data.currency }) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <SimpleEmpty icon={BookOpen} title="No research items yet" description="Money decisions and notes will appear here." />
        )}
      </SectionCard>
    </>
  );
}

function renderCheckins(data: SectionData) {
  const current = data.checkins.find(
    (row) => row.month === data.currentMonthStart
  );
  const completed = data.checkins.filter((row) => row.status === "completed");

  return (
    <>
      <MetricGrid>
        <StatCard label="Plan access" value={hasCheckins(data.ctx.plan) ? "Included" : "Plus"} icon={Gem} />
        <StatCard label="This month" value={current ? titleCase(current.status) : "Not started"} icon={CalendarCheck} />
        <StatCard label="Completed" value={String(completed.length)} icon={CheckSquare} />
        <StatCard label="Total check-ins" value={String(data.checkins.length)} icon={Users} />
      </MetricGrid>
      <SectionCard title="Money check-ins">
        {data.checkins.length > 0 ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.checkins.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatMonth(row.month)}</TableCell>
                  <TableCell className="font-medium">{row.title ?? "Money check-in"}</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                  <TableCell>{formatDate(row.scheduled_for)}</TableCell>
                  <TableCell>{formatDate(row.completed_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <SimpleEmpty icon={CalendarCheck} title="No check-ins yet" description="Monthly conversations will appear here when started." />
        )}
      </SectionCard>
    </>
  );
}

function renderDocuments(data: SectionData) {
  const reminders = data.documents.filter((row) => row.reminder_on);
  const expiring = data.documents.filter((row) => row.expires_on);
  const totalSize = data.documents.reduce(
    (sum, row) => sum + (row.file_size ?? 0),
    0
  );

  return (
    <>
      <MetricGrid>
        <StatCard label="Documents" value={String(data.documents.length)} icon={FileText} />
        <StatCard label="Storage" value={formatFileSize(totalSize)} icon={Landmark} />
        <StatCard label="Reminders" value={String(reminders.length)} icon={CalendarCheck} />
        <StatCard label="Expiring" value={String(expiring.length)} icon={ShieldAlert} />
      </MetricGrid>
      <SectionCard title="Document vault">
        {data.documents.length > 0 ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Reminder</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.documents.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-72 whitespace-normal font-medium">{row.name}</TableCell>
                  <TableCell>{DOCUMENT_CATEGORY_LABELS[row.category]}</TableCell>
                  <TableCell>{memberName(data.ctx, row.owner_id)}</TableCell>
                  <TableCell>{formatDate(row.reminder_on)}</TableCell>
                  <TableCell>{formatDate(row.expires_on)}</TableCell>
                  <TableCell><VisibilityBadge visibility={row.visibility} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatFileSize(row.file_size)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <SimpleEmpty icon={FileText} title="No documents yet" description="Uploaded records and reminders will appear here." />
        )}
      </SectionCard>
    </>
  );
}

function renderTasks(data: SectionData) {
  const open = data.tasks.filter((row) => row.status !== "done");
  const mine = open.filter((row) => row.assigned_to === data.me);
  const today = data.today.toISOString().slice(0, 10);
  const overdue = open.filter((row) => row.due_on && row.due_on < today);

  return (
    <>
      <MetricGrid>
        <StatCard label="Open tasks" value={String(open.length)} icon={CheckSquare} />
        <StatCard label="Assigned to you" value={String(mine.length)} icon={Users} />
        <StatCard label="Overdue" value={String(overdue.length)} icon={ShieldAlert} />
        <StatCard label="Completed" value={String(data.tasks.filter((row) => row.status === "done").length)} icon={CalendarCheck} />
      </MetricGrid>
      <SectionCard title="Task list">
        {data.tasks.length > 0 ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tasks.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-80 whitespace-normal font-medium">{row.title}</TableCell>
                  <TableCell>{memberName(data.ctx, row.assigned_to)}</TableCell>
                  <TableCell>{formatDate(row.due_on)}</TableCell>
                  <TableCell className="capitalize">{row.priority}</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <SimpleEmpty icon={CheckSquare} title="No tasks yet" description="Follow-ups and assigned work will appear here." />
        )}
      </SectionCard>
    </>
  );
}

function renderActivity(data: SectionData) {
  return (
    <>
      <MetricGrid>
        <StatCard label="Events loaded" value={String(data.events.length)} icon={Activity} />
        <StatCard label="Approvals" value={String(data.approvals.filter((row) => row.status === "pending").length)} icon={ShieldAlert} />
        <StatCard label="Members" value={String(data.ctx.members.length)} icon={Users} />
        <StatCard label="Workspace" value={data.ctx.workspace.name} icon={Landmark} />
      </MetricGrid>
      <SectionCard title="Recent activity">
        {data.events.length > 0 ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Summary</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.events.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-xl whitespace-normal font-medium">{row.summary}</TableCell>
                  <TableCell>{memberName(data.ctx, row.actor_id)}</TableCell>
                  <TableCell>{titleCase(row.event_type)}</TableCell>
                  <TableCell><VisibilityBadge visibility={row.visibility} /></TableCell>
                  <TableCell>{formatDate(row.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <SimpleEmpty icon={Activity} title="No activity yet" description="Workspace changes and milestones will appear here." />
        )}
      </SectionCard>
    </>
  );
}

function renderSettings(data: SectionData) {
  const style = MONEY_STYLE_META[data.ctx.workspace.money_style];

  return (
    <>
      <MetricGrid>
        <StatCard label="Workspace" value={data.ctx.workspace.name} icon={Landmark} />
        <StatCard label="Currency" value={data.currency} icon={Wallet} />
        <StatCard label="Money style" value={style.label} icon={Users} />
        <StatCard label="Default split" value={SPLIT_METHOD_META[data.ctx.workspace.default_split_method].label} icon={ArrowLeftRight} />
      </MetricGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Members">
          <div className="space-y-3">
            {data.ctx.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{member.profile.full_name ?? member.profile.email}</p>
                  <p className="text-xs text-muted-foreground">{member.profile.email}</p>
                </div>
                <Badge variant="outline" className="capitalize">{member.role}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Privacy defaults">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Personal net worth sharing</span>
              <Badge variant="outline">{data.ctx.profile.share_personal_net_worth ? "On" : "Off"}</Badge>
            </div>
            <Separator />
            <div>
              <p className="font-medium">{style.label}</p>
              <p className="mt-1 text-muted-foreground">{style.description}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function renderBilling(data: SectionData) {
  return (
    <>
      <MetricGrid>
        <StatCard label="Current plan" value={PLAN_META[data.ctx.plan].label} icon={Gem} />
        <StatCard label="Status" value={data.ctx.subscription?.status ? titleCase(data.ctx.subscription.status) : "Active"} icon={ShieldCheck} />
        <StatCard label="Goals limit" value={PLAN_META[data.ctx.plan].limits.savingsGoals?.toString() ?? "Unlimited"} icon={Target} />
        <StatCard label="Documents limit" value={PLAN_META[data.ctx.plan].limits.documents?.toString() ?? "Unlimited"} icon={FileText} />
      </MetricGrid>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(PLAN_META).map(([plan, meta]) => (
          <Card key={plan} className={plan === data.ctx.plan ? "border-primary" : undefined}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{meta.label}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{meta.tagline}</p>
                </div>
                {plan === data.ctx.plan ? <Badge>Current</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(meta.priceMonthly, { currency: "USD" })}
                <span className="text-sm font-normal text-muted-foreground"> / mo</span>
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {meta.features.slice(0, 5).map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <CheckSquare className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function renderAdmin(data: SectionData) {
  if (!data.ctx.profile.is_platform_admin) notFound();
  const pendingApprovals = data.approvals.filter(
    (row) => row.status === "pending"
  ).length;

  return (
    <>
      <MetricGrid>
        <StatCard label="Members" value={String(data.ctx.members.length)} icon={Users} />
        <StatCard label="Tracked rows" value={String(data.accounts.length + data.expenses.length + data.goals.length + data.tasks.length)} icon={Activity} />
        <StatCard label="Pending approvals" value={String(pendingApprovals)} icon={ShieldAlert} />
        <StatCard label="Plan" value={PLAN_META[data.ctx.plan].label} icon={Gem} />
      </MetricGrid>
      <SectionCard title="Workspace health">
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Area</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["Accounts", data.accounts.length, "Visible accounts"],
              ["Expenses", data.expenses.length, "Latest 100 visible expenses"],
              ["Goals", data.goals.length, "Visible savings goals"],
              ["Investments", data.investments.length, "Visible investments"],
              ["Documents", data.documents.length, "Visible documents"],
              ["Tasks", data.tasks.length, "Workspace tasks"],
              ["Activity", data.events.length, "Latest 100 visible events"],
            ].map(([label, count, note]) => (
              <TableRow key={label}>
                <TableCell className="font-medium">{label}</TableCell>
                <TableCell className="text-right tabular-nums">{count}</TableCell>
                <TableCell>{note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </SectionCard>
    </>
  );
}

function renderSection(slug: SectionSlug, data: SectionData) {
  switch (slug) {
    case "net-worth":
      return renderNetWorth(data);
    case "cash-flow":
      return renderCashFlow(data);
    case "activity":
      return renderActivity(data);
    case "expenses":
      return renderExpenses(data);
    case "budgets":
      return renderBudgets(data);
    case "debts":
      return renderDebts(data);
    case "emergency-fund":
      return renderEmergencyFund(data);
    case "goals":
      return renderGoals(data);
    case "couple-goals":
      return renderGoals(data, true);
    case "investments":
      return renderInvestments(data);
    case "research":
      return renderResearch(data);
    case "check-ins":
      return renderCheckins(data);
    case "documents":
      return renderDocuments(data);
    case "tasks":
      return renderTasks(data);
    case "settings":
      return renderSettings(data);
    case "billing":
      return renderBilling(data);
    case "admin":
      return renderAdmin(data);
  }
}

export default async function SectionPage(props: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await props.params;
  const slug = getSection(section);
  const meta = SECTIONS[slug];
  const ctx = await requireWorkspace();
  const data = await loadSectionData(ctx);

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <SectionActions
            section={slug}
            today={data.today.toISOString().slice(0, 10)}
            currentMonth={data.currentMonthStart.slice(0, 7)}
          />
        }
      />
      {renderSection(slug, data)}
    </div>
  );
}
