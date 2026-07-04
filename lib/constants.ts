/**
 * Shared vocabulary for TogetherWealth.
 * Every enum value here MUST match the Postgres enums in supabase/migrations.
 */

export const APP_NAME = "TogetherWealth";
export const APP_DESCRIPTION =
  "Collaborative financial planning for couples — plan, save, and grow together while keeping the independence you each need.";

// ---------------------------------------------------------------------------
// Visibility — the core privacy primitive. Applies to every financial item.
// ---------------------------------------------------------------------------
export const VISIBILITY_LEVELS = ["private", "shared", "household"] as const;
export type Visibility = (typeof VISIBILITY_LEVELS)[number];

export const VISIBILITY_META: Record<
  Visibility,
  { label: string; description: string }
> = {
  private: {
    label: "Private",
    description: "Only you can see this. It stays out of shared totals.",
  },
  shared: {
    label: "Shared with partner",
    description: "Yours, but your partner can see it and it counts in shared views.",
  },
  household: {
    label: "Household",
    description: "Belongs to both of you. Fully visible and jointly managed.",
  },
};

// ---------------------------------------------------------------------------
// Money style — how a couple organizes finances.
// ---------------------------------------------------------------------------
export const MONEY_STYLES = ["joint", "separate", "hybrid"] as const;
export type MoneyStyle = (typeof MONEY_STYLES)[number];

export const MONEY_STYLE_META: Record<
  MoneyStyle,
  { label: string; description: string }
> = {
  joint: {
    label: "Fully joint",
    description: "We pool everything and manage money as one household.",
  },
  separate: {
    label: "Fully separate",
    description: "We keep our finances separate and split shared costs.",
  },
  hybrid: {
    label: "Hybrid",
    description: "Some shared, some separate — the best of both.",
  },
};

// ---------------------------------------------------------------------------
// Expense splitting
// ---------------------------------------------------------------------------
export const SPLIT_METHODS = [
  "none",
  "equal",
  "percentage",
  "income_based",
  "fixed",
  "custom",
] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

export const SPLIT_METHOD_META: Record<
  SplitMethod,
  { label: string; description: string }
> = {
  none: { label: "No split", description: "Not shared — one person's expense." },
  equal: { label: "50 / 50", description: "Split evenly between partners." },
  percentage: {
    label: "Percentage",
    description: "Split by a percentage you choose.",
  },
  income_based: {
    label: "Income-based",
    description: "Split proportionally to each partner's income.",
  },
  fixed: {
    label: "Fixed amounts",
    description: "Each partner covers a fixed dollar amount.",
  },
  custom: { label: "Custom", description: "Set exact amounts per partner." },
};

export const EXPENSE_TYPES = ["shared", "personal", "reimbursable"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "housing",
  "utilities",
  "groceries",
  "dining",
  "transport",
  "health",
  "insurance",
  "childcare",
  "pets",
  "entertainment",
  "travel",
  "shopping",
  "personal_care",
  "subscriptions",
  "education",
  "gifts",
  "debt_payment",
  "savings",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  housing: "Housing",
  utilities: "Utilities",
  groceries: "Groceries",
  dining: "Dining out",
  transport: "Transport",
  health: "Health",
  insurance: "Insurance",
  childcare: "Childcare",
  pets: "Pets",
  entertainment: "Entertainment",
  travel: "Travel",
  shopping: "Shopping",
  personal_care: "Personal care",
  subscriptions: "Subscriptions",
  education: "Education",
  gifts: "Gifts & giving",
  debt_payment: "Debt payment",
  savings: "Savings",
  other: "Other",
};

export const RECURRENCE_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "annual",
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------
export const INCOME_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "annual",
  "irregular",
] as const;
export type IncomeFrequency = (typeof INCOME_FREQUENCIES)[number];

export const INCOME_TYPES = [
  "salary",
  "freelance",
  "business",
  "investment",
  "rental",
  "other",
] as const;
export type IncomeType = (typeof INCOME_TYPES)[number];

/** Normalize any income frequency to a monthly amount. */
export function toMonthlyAmount(
  amount: number,
  frequency: IncomeFrequency | RecurrenceFrequency
): number {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "annual":
      return amount / 12;
    case "irregular":
      return amount; // treated as a monthly estimate
  }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit_card",
  "investment",
  "cash",
  "loan",
  "other",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit card",
  investment: "Investment",
  cash: "Cash",
  loan: "Loan",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------
export const GOAL_TYPES = [
  "emergency_fund",
  "house",
  "wedding",
  "travel",
  "baby",
  "car",
  "education",
  "retirement",
  "custom",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergency_fund: "Emergency fund",
  house: "Home",
  wedding: "Wedding",
  travel: "Travel",
  baby: "Baby",
  car: "Car",
  education: "Education",
  retirement: "Retirement",
  custom: "Custom",
};

export const GOAL_STATUSES = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------
export const ASSET_CLASSES = [
  "stocks",
  "etf",
  "mutual_fund",
  "crypto",
  "retirement",
  "real_estate",
  "cash",
  "other",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  stocks: "Stocks",
  etf: "ETFs",
  mutual_fund: "Mutual funds",
  crypto: "Crypto",
  retirement: "Retirement accounts",
  real_estate: "Real estate",
  cash: "Cash",
  other: "Other",
};

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------
export const DEBT_TYPES = [
  "credit_card",
  "student_loan",
  "personal_loan",
  "car_loan",
  "mortgage",
  "custom",
] as const;
export type DebtType = (typeof DEBT_TYPES)[number];

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit card",
  student_loan: "Student loan",
  personal_loan: "Personal loan",
  car_loan: "Car loan",
  mortgage: "Mortgage",
  custom: "Other debt",
};

export const PAYOFF_STRATEGIES = ["snowball", "avalanche"] as const;
export type PayoffStrategy = (typeof PAYOFF_STRATEGIES)[number];

// ---------------------------------------------------------------------------
// Research hub
// ---------------------------------------------------------------------------
export const DECISION_TYPES = [
  "rent_vs_buy",
  "debt_vs_invest",
  "emergency_fund_size",
  "insurance",
  "budget_method",
  "retirement_planning",
  "child_planning",
  "travel_affordability",
  "major_purchase",
  "custom",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  rent_vs_buy: "Rent vs. buy",
  debt_vs_invest: "Pay debt vs. invest",
  emergency_fund_size: "Emergency fund size",
  insurance: "Insurance needs",
  budget_method: "Budgeting method",
  retirement_planning: "Retirement planning",
  child_planning: "Child planning",
  travel_affordability: "Travel affordability",
  major_purchase: "Major purchase",
  custom: "Custom decision",
};

export const RESEARCH_STATUSES = [
  "researching",
  "discussing",
  "decided",
  "archived",
] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

// ---------------------------------------------------------------------------
// Money check-ins
// ---------------------------------------------------------------------------
export const CHECKIN_STATUSES = [
  "draft",
  "answering",
  "revealed",
  "completed",
] as const;
export type CheckinStatus = (typeof CHECKIN_STATUSES)[number];

/** Agenda prompts each partner answers privately before revealing. */
export const CHECKIN_PROMPTS = [
  { key: "wins", label: "Wins", question: "What went well with money this month?" },
  { key: "concerns", label: "Concerns", question: "Anything worrying you about money right now?" },
  { key: "upcoming", label: "Upcoming expenses", question: "What expenses do you see coming next month?" },
  { key: "goals", label: "Goals progress", question: "How do you feel about our goals progress?" },
  { key: "budget", label: "Budget review", question: "Where did the budget feel tight or loose?" },
  { key: "debt", label: "Debt review", question: "How are you feeling about our debt plan?" },
  { key: "investments", label: "Investment review", question: "Any thoughts on our investments or risk level?" },
  { key: "commitments", label: "Next month", question: "What's one money commitment you want to make for next month?" },
] as const;
export type CheckinPromptKey = (typeof CHECKIN_PROMPTS)[number]["key"];

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const DOCUMENT_CATEGORIES = [
  "insurance",
  "tax",
  "loan",
  "will_estate",
  "account_summary",
  "receipt",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  insurance: "Insurance",
  tax: "Tax",
  loan: "Loans",
  will_estate: "Wills & estate",
  account_summary: "Account summaries",
  receipt: "Receipts",
  other: "Other",
};

export const DOCUMENTS_BUCKET = "documents";

// ---------------------------------------------------------------------------
// Tasks, approvals, notifications
// ---------------------------------------------------------------------------
export const TASK_STATUSES = ["open", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "canceled",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Actions that require the partner's approval before taking effect. */
export const APPROVAL_ACTION_TYPES = [
  "delete_shared_goal",
  "edit_shared_budget",
  "mark_debt_paid",
  "change_split_rules",
  "delete_shared_document",
] as const;
export type ApprovalActionType = (typeof APPROVAL_ACTION_TYPES)[number];

export const COMMENT_ENTITY_TYPES = [
  "goal",
  "expense",
  "investment",
  "debt",
  "research",
  "checkin",
  "document",
  "task",
] as const;
export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------
export const PLANS = ["free", "plus", "premium"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_META: Record<
  Plan,
  {
    label: string;
    priceMonthly: number;
    tagline: string;
    features: string[];
    limits: {
      workspaces: number;
      savingsGoals: number | null; // null = unlimited
      documents: number | null;
      checkins: boolean;
      advancedProjections: boolean;
      researchExport: boolean;
    };
  }
> = {
  free: {
    label: "Free",
    priceMonthly: 0,
    tagline: "Start planning together",
    features: [
      "One couple workspace",
      "Manual expense & income tracking",
      "Up to 3 savings goals",
      "Basic dashboard & net worth",
      "Debt tracking",
    ],
    limits: {
      workspaces: 1,
      savingsGoals: 3,
      documents: 10,
      checkins: false,
      advancedProjections: false,
      researchExport: false,
    },
  },
  plus: {
    label: "Plus",
    priceMonthly: 9,
    tagline: "For couples building momentum",
    features: [
      "Everything in Free",
      "Unlimited savings goals",
      "Unlimited documents vault",
      "Monthly money check-ins",
      "Advanced projections & insights",
      "Debt payoff comparisons",
    ],
    limits: {
      workspaces: 1,
      savingsGoals: null,
      documents: null,
      checkins: true,
      advancedProjections: true,
      researchExport: false,
    },
  },
  premium: {
    label: "Premium",
    priceMonthly: 19,
    tagline: "The complete toolkit",
    features: [
      "Everything in Plus",
      "Advanced research hub",
      "Data export",
      "Priority support",
      "Early access to new features",
      "Future read-only bank sync",
    ],
    limits: {
      workspaces: 3,
      savingsGoals: null,
      documents: null,
      checkins: true,
      advancedProjections: true,
      researchExport: true,
    },
  },
};

// ---------------------------------------------------------------------------
// Disclaimer — shown wherever projections/education appear.
// ---------------------------------------------------------------------------
export const EDUCATION_DISCLAIMER =
  "TogetherWealth provides educational information and projections based on the numbers you enter. It is not financial, investment, tax, or legal advice. Consider talking to a qualified professional before making major financial decisions.";

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  pricing: "/pricing",
  invite: (token: string) => `/invite/${token}`,
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  netWorth: "/net-worth",
  cashFlow: "/cash-flow",
  expenses: "/expenses",
  budgets: "/budgets",
  goals: "/goals",
  goal: (id: string) => `/goals/${id}`,
  coupleGoals: "/couple-goals",
  emergencyFund: "/emergency-fund",
  investments: "/investments",
  debts: "/debts",
  research: "/research",
  researchItem: (id: string) => `/research/${id}`,
  checkins: "/check-ins",
  checkin: (id: string) => `/check-ins/${id}`,
  documents: "/documents",
  tasks: "/tasks",
  activity: "/activity",
  settings: "/settings",
  billing: "/billing",
  admin: "/admin",
} as const;
