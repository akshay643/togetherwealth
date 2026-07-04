/**
 * Database contract for TogetherWealth.
 *
 * This file is the single source of truth for table shapes. The SQL
 * migrations in `supabase/migrations` MUST match these types exactly
 * (column names, enum values, nullability, defaults).
 */

import type {
  AccountType,
  ApprovalActionType,
  ApprovalStatus,
  AssetClass,
  CheckinStatus,
  CommentEntityType,
  DebtType,
  DecisionType,
  DocumentCategory,
  ExpenseCategory,
  ExpenseType,
  GoalStatus,
  GoalType,
  IncomeFrequency,
  IncomeType,
  MoneyStyle,
  Plan,
  RecurrenceFrequency,
  ResearchStatus,
  RiskLevel,
  SplitMethod,
  TaskPriority,
  TaskStatus,
  Visibility,
} from "@/lib/constants";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Row types (one per table)
// ---------------------------------------------------------------------------

export type Profile = {
  id: string; // = auth.users.id
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string; // default 'USD'
  onboarding_step: number; // default 0
  onboarding_complete: boolean; // default false
  risk_comfort: number | null; // 1 (very cautious) … 5 (very comfortable)
  money_style_pref: MoneyStyle | null;
  share_personal_net_worth: boolean; // default false
  financial_stress_notes: string | null;
  priorities: string[] | null;
  is_platform_admin: boolean; // default false
  created_at: string;
  updated_at: string;
}

export type CoupleWorkspace = {
  id: string;
  name: string;
  money_style: MoneyStyle; // default 'hybrid'
  default_split_method: SplitMethod; // default 'equal'
  /** e.g. { "percentages": { "<user_id>": 60, "<user_id>": 40 } } */
  default_split_config: Json | null;
  currency: string; // default 'USD'
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "partner";
  joined_at: string;
}

export type PartnerInvite = {
  id: string;
  workspace_id: string;
  email: string;
  token: string;
  invited_by: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  message: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export type Account = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  balance: number;
  currency: string; // default 'USD'
  visibility: Visibility; // default 'shared'
  is_joint: boolean; // default false
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type IncomeSource = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  income_type: IncomeType;
  amount: number;
  frequency: IncomeFrequency;
  visibility: Visibility; // default 'shared'
  is_active: boolean; // default true
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Expense = {
  id: string;
  workspace_id: string;
  created_by: string;
  paid_by: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  expense_date: string; // date
  expense_type: ExpenseType; // default 'shared'
  visibility: Visibility; // default 'shared'
  is_recurring: boolean; // default false
  recurrence: RecurrenceFrequency | null;
  split_method: SplitMethod; // default 'none'
  is_settled: boolean; // default false
  settled_at: string | null;
  merchant: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number; // this user's share
  percent: number | null;
  is_settled: boolean; // default false
  settled_at: string | null;
  created_at: string;
}

export type Budget = {
  id: string;
  workspace_id: string;
  owner_id: string | null; // null = household budget
  category: ExpenseCategory;
  amount: number;
  month: string; // date, first of month (yyyy-MM-01)
  scope: "household" | "personal"; // default 'household'
  visibility: Visibility; // default 'shared'
  rollover: boolean; // default false
  created_at: string;
  updated_at: string;
}

export type SavingsGoal = {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  target_date: string | null; // date
  monthly_contribution: number | null; // planned monthly amount
  visibility: Visibility; // default 'shared'
  status: GoalStatus; // default 'active'
  emoji: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type GoalContribution = {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  contributed_on: string; // date
  note: string | null;
  created_at: string;
}

export type Investment = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  asset_class: AssetClass;
  account_name: string | null;
  risk_level: RiskLevel | null;
  visibility: Visibility; // default 'shared'
  is_watchlist: boolean; // default false
  research_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InvestmentHolding = {
  id: string;
  investment_id: string;
  symbol: string | null;
  name: string;
  quantity: number | null;
  cost_basis: number | null; // total cost basis
  current_value: number;
  as_of: string | null; // date
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Debt = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  debt_type: DebtType;
  balance: number;
  original_balance: number | null;
  apr: number; // e.g. 22.99
  minimum_payment: number;
  due_day: number | null; // 1-31
  visibility: Visibility; // default 'shared'
  status: "active" | "paid_off"; // default 'active'
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type DebtPayment = {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  paid_on: string; // date
  note: string | null;
  created_at: string;
}

export type ResearchItem = {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  decision_type: DecisionType;
  notes: string | null;
  pros: string[]; // default []
  cons: string[]; // default []
  estimated_cost: number | null;
  final_decision: string | null;
  status: ResearchStatus; // default 'researching'
  visibility: Visibility; // default 'shared'
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ResearchComment = {
  id: string;
  research_item_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export type CheckinActionItem = {
  id: string;
  text: string;
  assigned_to: string | null;
  done: boolean;
}

export type MoneyCheckin = {
  id: string;
  workspace_id: string;
  month: string; // date, first of month
  title: string | null;
  status: CheckinStatus; // default 'draft'
  scheduled_for: string | null; // date
  summary: string | null;
  action_items: Json; // CheckinActionItem[] — default []
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CheckinAnswer = {
  id: string;
  checkin_id: string;
  user_id: string;
  prompt_key: string;
  answer: string;
  is_revealed: boolean; // default false
  created_at: string;
  updated_at: string;
}

export type DocumentRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  category: DocumentCategory;
  storage_path: string; // path in the 'documents' bucket
  file_size: number | null; // bytes
  mime_type: string | null;
  visibility: Visibility; // default 'shared'
  expires_on: string | null; // date
  reminder_on: string | null; // date
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Task = {
  id: string;
  workspace_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_on: string | null; // date
  status: TaskStatus; // default 'open'
  priority: TaskPriority; // default 'medium'
  related_type: CommentEntityType | null;
  related_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityEvent = {
  id: string;
  workspace_id: string;
  actor_id: string;
  event_type: string; // e.g. 'expense.created', 'goal.completed'
  entity_type: string | null;
  entity_id: string | null;
  summary: string; // human-readable, e.g. "Alex added expense Groceries $82"
  metadata: Json; // default {}
  visibility: Visibility; // default 'shared' — private events only visible to actor
  created_at: string;
}

export type Notification = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: string; // e.g. 'approval.requested', 'comment.added', 'reminder.document'
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean; // default false
  created_at: string;
}

export type Subscription = {
  id: string;
  workspace_id: string; // unique
  plan: Plan; // default 'free'
  status: "active" | "trialing" | "past_due" | "canceled"; // default 'active'
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean; // default false
  created_at: string;
  updated_at: string;
}

export type Comment = {
  id: string;
  workspace_id: string;
  user_id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export type Approval = {
  id: string;
  workspace_id: string;
  requested_by: string;
  action_type: ApprovalActionType;
  entity_type: string;
  entity_id: string | null;
  payload: Json; // default {} — proposed change details
  note: string | null;
  status: ApprovalStatus; // default 'pending'
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase Database type
// ---------------------------------------------------------------------------

/** Makes DB-defaulted columns optional on insert. */
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type TableOf<Row, InsertOptional extends keyof Row> = {
  Row: Row;
  Insert: WithOptional<Row, InsertOptional>;
  Update: Partial<Row>;
  Relationships: [];
};

type Timestamps = "created_at" | "updated_at";

export type Database = {
  public: {
    Tables: {
      profiles: TableOf<
        Profile,
        | Timestamps
        | "avatar_url"
        | "full_name"
        | "currency"
        | "onboarding_step"
        | "onboarding_complete"
        | "risk_comfort"
        | "money_style_pref"
        | "share_personal_net_worth"
        | "financial_stress_notes"
        | "priorities"
        | "is_platform_admin"
      >;
      couple_workspaces: TableOf<
        CoupleWorkspace,
        | "id"
        | Timestamps
        | "money_style"
        | "default_split_method"
        | "default_split_config"
        | "currency"
      >;
      workspace_members: TableOf<WorkspaceMember, "id" | "joined_at" | "role">;
      partner_invites: TableOf<
        PartnerInvite,
        "id" | "created_at" | "status" | "message" | "accepted_at" | "token" | "expires_at"
      >;
      accounts: TableOf<
        Account,
        | "id"
        | Timestamps
        | "institution"
        | "currency"
        | "visibility"
        | "is_joint"
        | "notes"
      >;
      income_sources: TableOf<
        IncomeSource,
        "id" | Timestamps | "visibility" | "is_active" | "notes"
      >;
      expenses: TableOf<
        Expense,
        | "id"
        | Timestamps
        | "expense_type"
        | "visibility"
        | "is_recurring"
        | "recurrence"
        | "split_method"
        | "is_settled"
        | "settled_at"
        | "merchant"
        | "notes"
      >;
      expense_splits: TableOf<
        ExpenseSplit,
        "id" | "created_at" | "percent" | "is_settled" | "settled_at"
      >;
      budgets: TableOf<
        Budget,
        "id" | Timestamps | "owner_id" | "scope" | "visibility" | "rollover"
      >;
      savings_goals: TableOf<
        SavingsGoal,
        | "id"
        | Timestamps
        | "target_date"
        | "monthly_contribution"
        | "visibility"
        | "status"
        | "emoji"
        | "notes"
      >;
      goal_contributions: TableOf<GoalContribution, "id" | "created_at" | "note">;
      investments: TableOf<
        Investment,
        | "id"
        | Timestamps
        | "account_name"
        | "risk_level"
        | "visibility"
        | "is_watchlist"
        | "research_notes"
        | "notes"
      >;
      investment_holdings: TableOf<
        InvestmentHolding,
        | "id"
        | Timestamps
        | "symbol"
        | "quantity"
        | "cost_basis"
        | "as_of"
        | "notes"
      >;
      debts: TableOf<
        Debt,
        | "id"
        | Timestamps
        | "original_balance"
        | "due_day"
        | "visibility"
        | "status"
        | "notes"
      >;
      debt_payments: TableOf<DebtPayment, "id" | "created_at" | "note">;
      research_items: TableOf<
        ResearchItem,
        | "id"
        | Timestamps
        | "notes"
        | "pros"
        | "cons"
        | "estimated_cost"
        | "final_decision"
        | "status"
        | "visibility"
        | "decided_at"
      >;
      research_comments: TableOf<ResearchComment, "id" | "created_at">;
      money_checkins: TableOf<
        MoneyCheckin,
        | "id"
        | Timestamps
        | "title"
        | "status"
        | "scheduled_for"
        | "summary"
        | "action_items"
        | "completed_at"
      >;
      checkin_answers: TableOf<
        CheckinAnswer,
        "id" | Timestamps | "is_revealed"
      >;
      documents: TableOf<
        DocumentRow,
        | "id"
        | Timestamps
        | "file_size"
        | "mime_type"
        | "visibility"
        | "expires_on"
        | "reminder_on"
        | "notes"
      >;
      tasks: TableOf<
        Task,
        | "id"
        | Timestamps
        | "assigned_to"
        | "description"
        | "due_on"
        | "status"
        | "priority"
        | "related_type"
        | "related_id"
        | "completed_at"
      >;
      activity_events: TableOf<
        ActivityEvent,
        "id" | "created_at" | "entity_type" | "entity_id" | "metadata" | "visibility"
      >;
      notifications: TableOf<
        Notification,
        "id" | "created_at" | "workspace_id" | "body" | "link" | "is_read"
      >;
      subscriptions: TableOf<
        Subscription,
        | "id"
        | Timestamps
        | "plan"
        | "status"
        | "stripe_customer_id"
        | "stripe_subscription_id"
        | "current_period_end"
        | "cancel_at_period_end"
      >;
      comments: TableOf<Comment, "id" | Timestamps>;
      approvals: TableOf<
        Approval,
        | "id"
        | "created_at"
        | "entity_id"
        | "payload"
        | "note"
        | "status"
        | "decided_by"
        | "decided_at"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_workspace_member: {
        Args: { ws_id: string };
        Returns: boolean;
      };
      accept_partner_invite: {
        Args: { invite_token: string };
        Returns: string; // workspace_id
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// Convenience joined types
// ---------------------------------------------------------------------------

export type WorkspaceMemberWithProfile = WorkspaceMember & {
  profile: Profile;
};

export type ExpenseWithSplits = Expense & {
  expense_splits: ExpenseSplit[];
};

export type GoalWithContributions = SavingsGoal & {
  goal_contributions: GoalContribution[];
};

export type InvestmentWithHoldings = Investment & {
  investment_holdings: InvestmentHolding[];
};

export type DebtWithPayments = Debt & {
  debt_payments: DebtPayment[];
};
