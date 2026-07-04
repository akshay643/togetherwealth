-- ===========================================================================
-- TogetherWealth — 00001_schema.sql
-- Tables, enums, defaults, indexes, and triggers.
-- MUST stay in lockstep with lib/types/database.ts and lib/constants.ts.
-- ===========================================================================

-- gen_random_uuid() is built into Postgres 13+; pgcrypto provides
-- gen_random_bytes() (invite tokens) and crypt()/gen_salt() (seed users).
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (values MUST match lib/constants.ts exactly)
-- ---------------------------------------------------------------------------

create type public.visibility as enum ('private', 'shared', 'household');

create type public.money_style as enum ('joint', 'separate', 'hybrid');

create type public.split_method as enum
  ('none', 'equal', 'percentage', 'income_based', 'fixed', 'custom');

create type public.expense_type as enum ('shared', 'personal', 'reimbursable');

create type public.expense_category as enum (
  'housing', 'utilities', 'groceries', 'dining', 'transport', 'health',
  'insurance', 'childcare', 'pets', 'entertainment', 'travel', 'shopping',
  'personal_care', 'subscriptions', 'education', 'gifts', 'debt_payment',
  'savings', 'other'
);

create type public.recurrence_frequency as enum
  ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual');

create type public.income_frequency as enum
  ('weekly', 'biweekly', 'monthly', 'annual', 'irregular');

create type public.income_type as enum
  ('salary', 'freelance', 'business', 'investment', 'rental', 'other');

create type public.account_type as enum
  ('checking', 'savings', 'credit_card', 'investment', 'cash', 'loan', 'other');

create type public.goal_type as enum (
  'emergency_fund', 'house', 'wedding', 'travel', 'baby', 'car',
  'education', 'retirement', 'custom'
);

create type public.goal_status as enum
  ('active', 'paused', 'completed', 'archived');

create type public.asset_class as enum (
  'stocks', 'etf', 'mutual_fund', 'crypto', 'retirement', 'real_estate',
  'cash', 'other'
);

create type public.risk_level as enum ('low', 'medium', 'high');

create type public.debt_type as enum (
  'credit_card', 'student_loan', 'personal_loan', 'car_loan', 'mortgage',
  'custom'
);

create type public.debt_status as enum ('active', 'paid_off');

create type public.decision_type as enum (
  'rent_vs_buy', 'debt_vs_invest', 'emergency_fund_size', 'insurance',
  'budget_method', 'retirement_planning', 'child_planning',
  'travel_affordability', 'major_purchase', 'custom'
);

create type public.research_status as enum
  ('researching', 'discussing', 'decided', 'archived');

create type public.checkin_status as enum
  ('draft', 'answering', 'revealed', 'completed');

create type public.document_category as enum (
  'insurance', 'tax', 'loan', 'will_estate', 'account_summary', 'receipt',
  'other'
);

create type public.task_status as enum ('open', 'in_progress', 'done');

create type public.task_priority as enum ('low', 'medium', 'high');

create type public.approval_status as enum
  ('pending', 'approved', 'rejected', 'canceled');

create type public.approval_action_type as enum (
  'delete_shared_goal', 'edit_shared_budget', 'mark_debt_paid',
  'change_split_rules', 'delete_shared_document'
);

create type public.comment_entity_type as enum (
  'goal', 'expense', 'investment', 'debt', 'research', 'checkin',
  'document', 'task'
);

create type public.plan as enum ('free', 'plus', 'premium');

create type public.member_role as enum ('owner', 'partner');

create type public.invite_status as enum
  ('pending', 'accepted', 'expired', 'revoked');

create type public.subscription_status as enum
  ('active', 'trialing', 'past_due', 'canceled');

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per auth user. Created automatically by handle_new_user().
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  email                    text not null,
  full_name                text,
  avatar_url               text,
  currency                 text not null default 'USD',
  onboarding_step          integer not null default 0,
  onboarding_complete      boolean not null default false,
  risk_comfort             integer check (risk_comfort between 1 and 5),
  money_style_pref         public.money_style,
  share_personal_net_worth boolean not null default false,
  financial_stress_notes   text,
  priorities               text[],
  is_platform_admin        boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.couple_workspaces (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  money_style          public.money_style not null default 'hybrid',
  default_split_method public.split_method not null default 'equal',
  default_split_config jsonb,
  currency             text not null default 'USD',
  created_by           uuid not null references public.profiles (id) on delete cascade,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.member_role not null default 'partner',
  joined_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.partner_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  email        text not null,
  token        text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  invited_by   uuid not null references public.profiles (id) on delete cascade,
  status       public.invite_status not null default 'pending',
  message      text,
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table public.accounts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  type         public.account_type not null,
  institution  text,
  balance      numeric(14,2) not null,
  currency     text not null default 'USD',
  visibility   public.visibility not null default 'shared',
  is_joint     boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.income_sources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  income_type  public.income_type not null,
  amount       numeric(14,2) not null,
  frequency    public.income_frequency not null,
  visibility   public.visibility not null default 'shared',
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  paid_by      uuid not null references public.profiles (id) on delete cascade,
  description  text not null,
  amount       numeric(14,2) not null,
  category     public.expense_category not null,
  expense_date date not null,
  expense_type public.expense_type not null default 'shared',
  visibility   public.visibility not null default 'shared',
  is_recurring boolean not null default false,
  recurrence   public.recurrence_frequency,
  split_method public.split_method not null default 'none',
  is_settled   boolean not null default false,
  settled_at   timestamptz,
  merchant     text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.expense_splits (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     numeric(14,2) not null,
  percent    numeric(6,3),
  is_settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  owner_id     uuid references public.profiles (id) on delete cascade, -- null = household budget
  category     public.expense_category not null,
  amount       numeric(14,2) not null,
  month        date not null, -- first of month (yyyy-MM-01)
  scope        text not null default 'household' check (scope in ('household', 'personal')),
  visibility   public.visibility not null default 'shared',
  rollover     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One budget per workspace/category/month/scope/owner; null owner (household)
-- is folded to the nil uuid so it participates in uniqueness.
create unique index budgets_unique_per_month
  on public.budgets (
    workspace_id, category, month, scope,
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table public.savings_goals (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.couple_workspaces (id) on delete cascade,
  created_by           uuid not null references public.profiles (id) on delete cascade,
  name                 text not null,
  goal_type            public.goal_type not null,
  target_amount        numeric(14,2) not null,
  target_date          date,
  monthly_contribution numeric(14,2),
  visibility           public.visibility not null default 'shared',
  status               public.goal_status not null default 'active',
  emoji                text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null references public.savings_goals (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  amount         numeric(14,2) not null,
  contributed_on date not null,
  note           text,
  created_at     timestamptz not null default now()
);

create table public.investments (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.couple_workspaces (id) on delete cascade,
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  name           text not null,
  asset_class    public.asset_class not null,
  account_name   text,
  risk_level     public.risk_level,
  visibility     public.visibility not null default 'shared',
  is_watchlist   boolean not null default false,
  research_notes text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.investment_holdings (
  id            uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments (id) on delete cascade,
  symbol        text,
  name          text not null,
  quantity      numeric(18,6),
  cost_basis    numeric(14,2),
  current_value numeric(14,2) not null,
  as_of         date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.debts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.couple_workspaces (id) on delete cascade,
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  name             text not null,
  debt_type        public.debt_type not null,
  balance          numeric(14,2) not null,
  original_balance numeric(14,2),
  apr              numeric(6,3) not null,
  minimum_payment  numeric(14,2) not null,
  due_day          integer check (due_day between 1 and 31),
  visibility       public.visibility not null default 'shared',
  status           public.debt_status not null default 'active',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.debt_payments (
  id         uuid primary key default gen_random_uuid(),
  debt_id    uuid not null references public.debts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     numeric(14,2) not null,
  paid_on    date not null,
  note       text,
  created_at timestamptz not null default now()
);

create table public.research_items (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.couple_workspaces (id) on delete cascade,
  created_by     uuid not null references public.profiles (id) on delete cascade,
  title          text not null,
  decision_type  public.decision_type not null,
  notes          text,
  pros           text[] not null default '{}',
  cons           text[] not null default '{}',
  estimated_cost numeric(14,2),
  final_decision text,
  status         public.research_status not null default 'researching',
  visibility     public.visibility not null default 'shared',
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.research_comments (
  id               uuid primary key default gen_random_uuid(),
  research_item_id uuid not null references public.research_items (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  body             text not null,
  created_at       timestamptz not null default now()
);

create table public.money_checkins (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.couple_workspaces (id) on delete cascade,
  month         date not null, -- first of month
  title         text,
  status        public.checkin_status not null default 'draft',
  scheduled_for date,
  summary       text,
  action_items  jsonb not null default '[]'::jsonb,
  created_by    uuid not null references public.profiles (id) on delete cascade,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.checkin_answers (
  id          uuid primary key default gen_random_uuid(),
  checkin_id  uuid not null references public.money_checkins (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  prompt_key  text not null,
  answer      text not null,
  is_revealed boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (checkin_id, user_id, prompt_key)
);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  category     public.document_category not null,
  storage_path text not null, -- path within the 'documents' bucket: {workspace_id}/{owner_id}/{filename}
  file_size    bigint,
  mime_type    text,
  visibility   public.visibility not null default 'shared',
  expires_on   date,
  reminder_on  date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  assigned_to  uuid references public.profiles (id) on delete set null,
  title        text not null,
  description  text,
  due_on       date,
  status       public.task_status not null default 'open',
  priority     public.task_priority not null default 'medium',
  related_type public.comment_entity_type,
  related_id   uuid,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.activity_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  actor_id     uuid not null references public.profiles (id) on delete cascade,
  event_type   text not null,
  entity_type  text,
  entity_id    uuid,
  summary      text not null,
  metadata     jsonb not null default '{}'::jsonb,
  visibility   public.visibility not null default 'shared',
  created_at   timestamptz not null default now()
);

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.couple_workspaces (id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  link         text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null unique references public.couple_workspaces (id) on delete cascade,
  plan                   public.plan not null default 'free',
  status                 public.subscription_status not null default 'active',
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  entity_type  public.comment_entity_type not null,
  entity_id    uuid not null,
  body         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.approvals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  action_type  public.approval_action_type not null,
  entity_type  text not null,
  entity_id    uuid,
  payload      jsonb not null default '{}'::jsonb,
  note         text,
  status       public.approval_status not null default 'pending',
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (every FK column + hot query paths)
-- ---------------------------------------------------------------------------

create index workspace_members_user_id_idx      on public.workspace_members (user_id);
create index partner_invites_workspace_id_idx   on public.partner_invites (workspace_id);
create index partner_invites_invited_by_idx     on public.partner_invites (invited_by);
create index partner_invites_email_idx          on public.partner_invites (lower(email));
create index accounts_workspace_id_idx          on public.accounts (workspace_id);
create index accounts_owner_id_idx              on public.accounts (owner_id);
create index income_sources_workspace_id_idx    on public.income_sources (workspace_id);
create index income_sources_owner_id_idx        on public.income_sources (owner_id);
create index expenses_workspace_id_idx          on public.expenses (workspace_id);
create index expenses_created_by_idx            on public.expenses (created_by);
create index expenses_paid_by_idx               on public.expenses (paid_by);
create index expenses_workspace_date_idx        on public.expenses (workspace_id, expense_date);
create index expense_splits_expense_id_idx      on public.expense_splits (expense_id);
create index expense_splits_user_id_idx         on public.expense_splits (user_id);
create index budgets_owner_id_idx               on public.budgets (owner_id);
create index budgets_workspace_month_idx        on public.budgets (workspace_id, month);
create index savings_goals_workspace_id_idx     on public.savings_goals (workspace_id);
create index savings_goals_created_by_idx       on public.savings_goals (created_by);
create index goal_contributions_goal_id_idx     on public.goal_contributions (goal_id);
create index goal_contributions_user_id_idx     on public.goal_contributions (user_id);
create index investments_workspace_id_idx       on public.investments (workspace_id);
create index investments_owner_id_idx           on public.investments (owner_id);
create index investment_holdings_investment_id_idx on public.investment_holdings (investment_id);
create index debts_workspace_id_idx             on public.debts (workspace_id);
create index debts_owner_id_idx                 on public.debts (owner_id);
create index debt_payments_debt_id_idx          on public.debt_payments (debt_id);
create index debt_payments_user_id_idx          on public.debt_payments (user_id);
create index research_items_workspace_id_idx    on public.research_items (workspace_id);
create index research_items_created_by_idx      on public.research_items (created_by);
create index research_comments_item_id_idx      on public.research_comments (research_item_id);
create index research_comments_user_id_idx      on public.research_comments (user_id);
create index money_checkins_workspace_month_idx on public.money_checkins (workspace_id, month);
create index money_checkins_created_by_idx      on public.money_checkins (created_by);
create index checkin_answers_user_id_idx        on public.checkin_answers (user_id);
create index documents_workspace_id_idx         on public.documents (workspace_id);
create index documents_owner_id_idx             on public.documents (owner_id);
create index tasks_workspace_id_idx             on public.tasks (workspace_id);
create index tasks_created_by_idx               on public.tasks (created_by);
create index tasks_assigned_to_idx              on public.tasks (assigned_to);
create index activity_events_workspace_created_idx on public.activity_events (workspace_id, created_at desc);
create index activity_events_actor_id_idx       on public.activity_events (actor_id);
create index notifications_user_read_idx        on public.notifications (user_id, is_read);
create index notifications_workspace_id_idx     on public.notifications (workspace_id);
create index comments_workspace_id_idx          on public.comments (workspace_id);
create index comments_user_id_idx               on public.comments (user_id);
create index comments_entity_idx                on public.comments (entity_type, entity_id);
create index approvals_workspace_id_idx         on public.approvals (workspace_id);
create index approvals_requested_by_idx         on public.approvals (requested_by);
create index approvals_decided_by_idx           on public.approvals (decided_by);

-- ---------------------------------------------------------------------------
-- updated_at triggers (every table that has updated_at)
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.profiles            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.couple_workspaces   for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.accounts            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.income_sources      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.expenses            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.budgets             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.savings_goals       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.investments         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.investment_holdings for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.debts               for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.research_items      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.money_checkins      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.checkin_answers     for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.documents           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks               for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.subscriptions       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.comments            for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profiles row
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- New workspace -> creator membership (owner) + free subscription.
-- Security definer so it works before any RLS-visible membership exists.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  insert into public.subscriptions (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.couple_workspaces
  for each row execute function public.handle_new_workspace();
