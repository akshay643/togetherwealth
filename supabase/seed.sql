-- ===========================================================================
-- TogetherWealth — seed.sql
-- Rich demo data for local development: two users (Alex & Jamie) sharing one
-- workspace, with ~3 months of coherent financial history.
--
-- Demo logins (password for both: demo-password-123):
--   alex@demo.togetherwealth.app   (Alex Rivera)
--   jamie@demo.togetherwealth.app  (Jamie Chen)
--
-- All dates are relative to now(), so the data always looks fresh.
-- Idempotent-ish: fixed UUIDs + ON CONFLICT DO NOTHING where practical.
--
-- Fixed UUID map (digits/hex only, grouped by prefix):
--   users        1111… (Alex) / 2222… (Jamie)     workspace  3333…
--   accounts     ac…01-05    income     1a…01-04  expenses   e0…01-40
--   budgets      b0…01-06    goals      5a…01-04  contribs   5c…01-19
--   investments  10…01-06    holdings   1d…01-04  debts      de…01-03
--   payments     dd…01-08    research   4e…01-03  r.comments 4c…01-04
--   checkins     c1…01-02    documents  d0…01-03  tasks      7a…01-05
--   activity     ae…01-16    notifs     0f…01-06  comments   c0…01-04
--   invite       9e…01
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Auth users + identities (profiles rows appear via handle_new_user trigger)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'alex@demo.togetherwealth.app',
    extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Alex Rivera"}'::jsonb,
    now() - interval '95 days', now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'jamie@demo.togetherwealth.app',
    extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Jamie Chen"}'::jsonb,
    now() - interval '92 days', now(),
    '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
values
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'email',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"alex@demo.togetherwealth.app","email_verified":true}'::jsonb,
    now(), now() - interval '95 days', now()
  ),
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'email',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"jamie@demo.togetherwealth.app","email_verified":true}'::jsonb,
    now(), now() - interval '92 days', now()
  )
on conflict (provider_id, provider) do nothing;

-- Flesh out the trigger-created profiles.
update public.profiles set
  full_name                = 'Alex Rivera',
  onboarding_step          = 6,
  onboarding_complete      = true,
  risk_comfort             = 3,
  money_style_pref         = 'hybrid',
  share_personal_net_worth = true,
  priorities               = array['Buy a home', 'Emergency fund', 'Travel more']
where id = '11111111-1111-1111-1111-111111111111';

update public.profiles set
  full_name                = 'Jamie Chen',
  onboarding_step          = 6,
  onboarding_complete      = true,
  risk_comfort             = 4,
  money_style_pref         = 'hybrid',
  share_personal_net_worth = false,
  priorities               = array['Pay off student loan', 'Retirement', 'Travel more']
where id = '22222222-2222-2222-2222-222222222222';

-- ---------------------------------------------------------------------------
-- 2. Workspace, membership, invite, subscription
--    (on_workspace_created trigger adds Alex as owner + a free subscription)
-- ---------------------------------------------------------------------------

insert into public.couple_workspaces
  (id, name, money_style, default_split_method, default_split_config, created_by, created_at)
values (
  '33333333-3333-3333-3333-333333333333',
  'Alex & Jamie',
  'hybrid',
  'income_based',
  '{"percentages":{"11111111-1111-1111-1111-111111111111":62,"22222222-2222-2222-2222-222222222222":38}}'::jsonb,
  '11111111-1111-1111-1111-111111111111',
  now() - interval '90 days'
)
on conflict (id) do nothing;

-- The accepted invite that brought Jamie in.
insert into public.partner_invites
  (id, workspace_id, email, token, invited_by, status, message, expires_at, accepted_at, created_at)
values (
  '9e000000-0000-4000-8000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  'jamie@demo.togetherwealth.app',
  'demo-invite-token-jamie',
  '11111111-1111-1111-1111-111111111111',
  'accepted',
  'Let''s finally get our money organized together!',
  now() - interval '76 days',
  now() - interval '89 days',
  now() - interval '90 days'
)
on conflict do nothing;

insert into public.workspace_members (workspace_id, user_id, role, joined_at)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'partner',
  now() - interval '89 days'
)
on conflict (workspace_id, user_id) do nothing;

-- The on_workspace_created trigger stamped Alex's membership with now();
-- backdate it so the owner joined before the partner.
update public.workspace_members
set joined_at = now() - interval '90 days'
where workspace_id = '33333333-3333-3333-3333-333333333333'
  and user_id = '11111111-1111-1111-1111-111111111111';

-- Demo couple is on the Plus plan.
update public.subscriptions
set plan = 'plus'
where workspace_id = '33333333-3333-3333-3333-333333333333';

-- ---------------------------------------------------------------------------
-- 3. Income sources (2 each)
-- ---------------------------------------------------------------------------

insert into public.income_sources
  (id, workspace_id, owner_id, name, income_type, amount, frequency, visibility, is_active)
values
  ('1a000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Salary — product designer', 'salary', 6800, 'monthly', 'shared', true),
  ('1a000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Brokerage dividends', 'investment', 900, 'annual', 'shared', true),
  ('1a000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Salary — UX researcher', 'salary', 4200, 'monthly', 'shared', true),
  ('1a000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Freelance research projects', 'freelance', 600, 'monthly', 'private', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Accounts (5)
-- ---------------------------------------------------------------------------

insert into public.accounts
  (id, workspace_id, owner_id, name, type, institution, balance, visibility, is_joint, notes)
values
  ('ac000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Joint checking', 'checking', 'Chase', 8450, 'household', true,
   'Bills and everyday shared spending.'),
  ('ac000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Joint savings', 'savings', 'Ally', 24300, 'household', true,
   'Emergency fund + house fund live here.'),
  ('ac000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Alex personal checking', 'checking', 'Chase', 2150, 'private', false, null),
  ('ac000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Jamie personal checking', 'checking', 'Capital One', 1720, 'private', false, null),
  ('ac000000-0000-4000-8000-000000000005', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Fidelity brokerage', 'investment', 'Fidelity', 17410, 'shared', false, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Expenses (~40 over the last 3 months)
--    62/38 = income-based split (Alex/Jamie); splits generated below.
-- ---------------------------------------------------------------------------

-- Recurring: rent on the 1st of each of the last 3 months.
insert into public.expenses
  (id, workspace_id, created_by, paid_by, description, amount, category,
   expense_date, expense_type, visibility, is_recurring, recurrence, split_method, merchant)
values
  ('e0000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Rent', 2400, 'housing', (date_trunc('month', now()) - interval '2 months')::date,
   'shared', 'household', true, 'monthly', 'income_based', 'Maple Court Apartments'),
  ('e0000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Rent', 2400, 'housing', (date_trunc('month', now()) - interval '1 month')::date,
   'shared', 'household', true, 'monthly', 'income_based', 'Maple Court Apartments'),
  ('e0000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Rent', 2400, 'housing', date_trunc('month', now())::date,
   'shared', 'household', true, 'monthly', 'income_based', 'Maple Court Apartments'),

  -- Recurring: electric & gas (Jamie pays)
  ('e0000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Electric & gas', 172.40, 'utilities', (now() - interval '68 days')::date,
   'shared', 'household', true, 'monthly', 'income_based', 'City Power & Gas'),
  ('e0000000-0000-4000-8000-000000000005', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Electric & gas', 185.10, 'utilities', (now() - interval '38 days')::date,
   'shared', 'household', true, 'monthly', 'income_based', 'City Power & Gas'),
  ('e0000000-0000-4000-8000-000000000006', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Electric & gas', 190.25, 'utilities', (now() - interval '8 days')::date,
   'shared', 'household', true, 'monthly', 'income_based', 'City Power & Gas'),

  -- Recurring: streaming bundle (Alex pays, split 50/50)
  ('e0000000-0000-4000-8000-000000000007', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Streaming bundle', 45, 'subscriptions', (now() - interval '66 days')::date,
   'shared', 'shared', true, 'monthly', 'equal', 'Streamflix'),
  ('e0000000-0000-4000-8000-000000000008', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Streaming bundle', 45, 'subscriptions', (now() - interval '36 days')::date,
   'shared', 'shared', true, 'monthly', 'equal', 'Streamflix'),
  ('e0000000-0000-4000-8000-000000000009', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Streaming bundle', 45, 'subscriptions', (now() - interval '6 days')::date,
   'shared', 'shared', true, 'monthly', 'equal', 'Streamflix'),

  -- Recurring: car insurance (Jamie pays)
  ('e0000000-0000-4000-8000-000000000010', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Car insurance', 210, 'insurance', (now() - interval '64 days')::date,
   'shared', 'household', true, 'monthly', 'income_based', 'GoodHands Insurance'),
  ('e0000000-0000-4000-8000-000000000011', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Car insurance', 210, 'insurance', (now() - interval '34 days')::date,
   'shared', 'household', true, 'monthly', 'income_based', 'GoodHands Insurance'),
  ('e0000000-0000-4000-8000-000000000012', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Car insurance', 210, 'insurance', (now() - interval '4 days')::date,
   'shared', 'household', true, 'monthly', 'income_based', 'GoodHands Insurance'),

  -- Recurring: Alex's gym (personal, no split)
  ('e0000000-0000-4000-8000-000000000013', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Gym membership', 55, 'health', (now() - interval '62 days')::date,
   'personal', 'shared', true, 'monthly', 'none', 'FlexFit Gym'),
  ('e0000000-0000-4000-8000-000000000014', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Gym membership', 55, 'health', (now() - interval '32 days')::date,
   'personal', 'shared', true, 'monthly', 'none', 'FlexFit Gym'),
  ('e0000000-0000-4000-8000-000000000015', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Gym membership', 55, 'health', (now() - interval '2 days')::date,
   'personal', 'shared', true, 'monthly', 'none', 'FlexFit Gym'),

  -- Recurring: phone family plan (Jamie pays, split 50/50)
  ('e0000000-0000-4000-8000-000000000016', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Phone family plan', 130, 'utilities', (now() - interval '61 days')::date,
   'shared', 'household', true, 'monthly', 'equal', 'Horizon Mobile'),
  ('e0000000-0000-4000-8000-000000000017', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Phone family plan', 130, 'utilities', (now() - interval '31 days')::date,
   'shared', 'household', true, 'monthly', 'equal', 'Horizon Mobile'),
  ('e0000000-0000-4000-8000-000000000018', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Phone family plan', 130, 'utilities', (now() - interval '1 day')::date,
   'shared', 'household', true, 'monthly', 'equal', 'Horizon Mobile'),

  -- One-offs, oldest first (~2-3 months ago)
  ('e0000000-0000-4000-8000-000000000019', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Groceries', 148.32, 'groceries', (now() - interval '82 days')::date,
   'shared', 'household', false, null, 'income_based', 'Whole Foods'),
  ('e0000000-0000-4000-8000-000000000020', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Groceries', 96.50, 'groceries', (now() - interval '75 days')::date,
   'shared', 'household', false, null, 'income_based', 'Trader Joe''s'),
  ('e0000000-0000-4000-8000-000000000021', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Anniversary dinner', 84, 'dining', (now() - interval '72 days')::date,
   'shared', 'shared', false, null, 'equal', 'Lucia''s Trattoria'),
  ('e0000000-0000-4000-8000-000000000022', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Gas fill-up', 52, 'transport', (now() - interval '70 days')::date,
   'shared', 'household', false, null, 'income_based', 'Shell'),
  ('e0000000-0000-4000-8000-000000000023', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Concert tickets', 130, 'entertainment', (now() - interval '66 days')::date,
   'shared', 'shared', false, null, 'equal', 'TicketWave'),
  ('e0000000-0000-4000-8000-000000000024', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Groceries', 121.75, 'groceries', (now() - interval '63 days')::date,
   'shared', 'household', false, null, 'income_based', 'Safeway'),

  -- ~1-2 months ago
  ('e0000000-0000-4000-8000-000000000025', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Groceries', 138.20, 'groceries', (now() - interval '55 days')::date,
   'shared', 'household', false, null, 'income_based', 'Whole Foods'),
  ('e0000000-0000-4000-8000-000000000026', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Weekend brunch', 46.80, 'dining', (now() - interval '52 days')::date,
   'shared', 'shared', false, null, 'equal', 'Sunny Side Cafe'),
  ('e0000000-0000-4000-8000-000000000027', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Pharmacy', 28.40, 'health', (now() - interval '50 days')::date,
   'personal', 'shared', false, null, 'none', 'CVS'),
  ('e0000000-0000-4000-8000-000000000028', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Gas fill-up', 49.75, 'transport', (now() - interval '47 days')::date,
   'shared', 'household', false, null, 'income_based', 'Chevron'),
  ('e0000000-0000-4000-8000-000000000029', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Groceries', 104.60, 'groceries', (now() - interval '41 days')::date,
   'shared', 'household', false, null, 'income_based', 'Trader Joe''s'),
  ('e0000000-0000-4000-8000-000000000030', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'New running shoes', 115, 'shopping', (now() - interval '38 days')::date,
   'personal', 'shared', false, null, 'none', 'RunnerHub'),
  ('e0000000-0000-4000-8000-000000000031', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Coast trip — hotel', 268, 'travel', (now() - interval '36 days')::date,
   'shared', 'shared', false, null, 'equal', 'Seaside Inn'),
  ('e0000000-0000-4000-8000-000000000032', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Groceries', 92.15, 'groceries', (now() - interval '33 days')::date,
   'shared', 'household', false, null, 'income_based', 'Safeway'),

  -- Last ~4 weeks
  ('e0000000-0000-4000-8000-000000000033', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Groceries', 135.48, 'groceries', (now() - interval '26 days')::date,
   'shared', 'household', false, null, 'income_based', 'Whole Foods'),
  ('e0000000-0000-4000-8000-000000000034', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Dinner with friends', 92.30, 'dining', (now() - interval '21 days')::date,
   'shared', 'shared', false, null, 'equal', 'The Copper Pot'),
  ('e0000000-0000-4000-8000-000000000035', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Gas fill-up', 54.20, 'transport', (now() - interval '18 days')::date,
   'shared', 'household', false, null, 'income_based', 'Shell'),
  ('e0000000-0000-4000-8000-000000000036', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Vet visit — Miso''s checkup', 185, 'pets', (now() - interval '15 days')::date,
   'shared', 'household', false, null, 'income_based', 'Paws & Claws Vet'),
  ('e0000000-0000-4000-8000-000000000037', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Groceries', 118.90, 'groceries', (now() - interval '12 days')::date,
   'shared', 'household', false, null, 'income_based', 'Trader Joe''s'),
  ('e0000000-0000-4000-8000-000000000038', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Movie night', 34, 'entertainment', (now() - interval '9 days')::date,
   'shared', 'shared', false, null, 'equal', 'Grand Cinema'),
  -- Jamie's private surprise for Alex — must NEVER show up for Alex.
  ('e0000000-0000-4000-8000-000000000039', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Birthday gift for Alex', 95, 'gifts', (now() - interval '6 days')::date,
   'personal', 'private', false, null, 'none', 'Analog Watch Co.'),
  ('e0000000-0000-4000-8000-000000000040', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Groceries', 87.25, 'groceries', (now() - interval '3 days')::date,
   'shared', 'household', false, null, 'income_based', 'Safeway')
on conflict (id) do nothing;

-- Anything split and older than ~30 days has been settled.
update public.expenses
set is_settled = true,
    settled_at = expense_date + interval '3 days'
where workspace_id = '33333333-3333-3333-3333-333333333333'
  and split_method <> 'none'
  and expense_date < (now() - interval '30 days')::date
  and not is_settled;

-- Generate splits from the expenses themselves so the math always matches.
-- Income-based: Alex 62% (rounded), Jamie gets the exact remainder.
insert into public.expense_splits (expense_id, user_id, amount, percent, is_settled, settled_at)
select e.id, '11111111-1111-1111-1111-111111111111', round(e.amount * 0.62, 2), 62, e.is_settled, e.settled_at
from public.expenses e
where e.workspace_id = '33333333-3333-3333-3333-333333333333'
  and e.split_method = 'income_based'
  and not exists (
    select 1 from public.expense_splits s
    where s.expense_id = e.id and s.user_id = '11111111-1111-1111-1111-111111111111'
  );

insert into public.expense_splits (expense_id, user_id, amount, percent, is_settled, settled_at)
select e.id, '22222222-2222-2222-2222-222222222222', e.amount - round(e.amount * 0.62, 2), 38, e.is_settled, e.settled_at
from public.expenses e
where e.workspace_id = '33333333-3333-3333-3333-333333333333'
  and e.split_method = 'income_based'
  and not exists (
    select 1 from public.expense_splits s
    where s.expense_id = e.id and s.user_id = '22222222-2222-2222-2222-222222222222'
  );

-- Equal splits: 50/50, remainder cent to Jamie.
insert into public.expense_splits (expense_id, user_id, amount, percent, is_settled, settled_at)
select e.id, '11111111-1111-1111-1111-111111111111', round(e.amount * 0.5, 2), 50, e.is_settled, e.settled_at
from public.expenses e
where e.workspace_id = '33333333-3333-3333-3333-333333333333'
  and e.split_method = 'equal'
  and not exists (
    select 1 from public.expense_splits s
    where s.expense_id = e.id and s.user_id = '11111111-1111-1111-1111-111111111111'
  );

insert into public.expense_splits (expense_id, user_id, amount, percent, is_settled, settled_at)
select e.id, '22222222-2222-2222-2222-222222222222', e.amount - round(e.amount * 0.5, 2), 50, e.is_settled, e.settled_at
from public.expenses e
where e.workspace_id = '33333333-3333-3333-3333-333333333333'
  and e.split_method = 'equal'
  and not exists (
    select 1 from public.expense_splits s
    where s.expense_id = e.id and s.user_id = '22222222-2222-2222-2222-222222222222'
  );

-- ---------------------------------------------------------------------------
-- 6. Budgets — current month, 6 household categories
-- ---------------------------------------------------------------------------

insert into public.budgets (id, workspace_id, owner_id, category, amount, month, scope, visibility)
values
  ('b0000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333', null,
   'groceries', 700, date_trunc('month', now())::date, 'household', 'household'),
  ('b0000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333', null,
   'dining', 300, date_trunc('month', now())::date, 'household', 'household'),
  ('b0000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333', null,
   'utilities', 350, date_trunc('month', now())::date, 'household', 'household'),
  ('b0000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333', null,
   'transport', 220, date_trunc('month', now())::date, 'household', 'household'),
  ('b0000000-0000-4000-8000-000000000005', '33333333-3333-3333-3333-333333333333', null,
   'entertainment', 150, date_trunc('month', now())::date, 'household', 'household'),
  ('b0000000-0000-4000-8000-000000000006', '33333333-3333-3333-3333-333333333333', null,
   'subscriptions', 100, date_trunc('month', now())::date, 'household', 'household')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 7. Savings goals + contributions
-- ---------------------------------------------------------------------------

insert into public.savings_goals
  (id, workspace_id, created_by, name, goal_type, target_amount, target_date,
   monthly_contribution, visibility, status, emoji, notes)
values
  ('5a000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Emergency fund', 'emergency_fund', 30000, null,
   2700, 'household', 'active', '🛟', 'Six months of essential expenses. Decided together in our research hub.'),
  ('5a000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'House down payment', 'house', 80000,
   (now() + interval '3 years')::date, 1200, 'household', 'active', '🏡',
   'Targeting a 15-20% down payment in about three years.'),
  ('5a000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Japan trip', 'travel', 6000,
   (now() + interval '10 months')::date, 350, 'shared', 'active', '🗾',
   'Two weeks: Tokyo, Kyoto, and an onsen stay.'),
  -- Jamie's private goal — invisible to Alex.
  ('5a000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'New laptop', 'custom', 2500,
   (now() + interval '5 months')::date, 250, 'private', 'active', '💻', null)
on conflict (id) do nothing;

-- 19 contributions. Emergency fund totals $13,500 (Alex 5×$1,500 + Jamie 5×$1,200).
insert into public.goal_contributions (id, goal_id, user_id, amount, contributed_on, note)
values
  ('5c000000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 1500, (now() - interval '150 days')::date, 'Kickoff transfer'),
  ('5c000000-0000-4000-8000-000000000002', '5a000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 1200, (now() - interval '140 days')::date, null),
  ('5c000000-0000-4000-8000-000000000003', '5a000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 1500, (now() - interval '120 days')::date, null),
  ('5c000000-0000-4000-8000-000000000004', '5a000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 1200, (now() - interval '110 days')::date, null),
  ('5c000000-0000-4000-8000-000000000005', '5a000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 1500, (now() - interval '90 days')::date, null),
  ('5c000000-0000-4000-8000-000000000006', '5a000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 1200, (now() - interval '80 days')::date, null),
  ('5c000000-0000-4000-8000-000000000007', '5a000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 1500, (now() - interval '60 days')::date, null),
  ('5c000000-0000-4000-8000-000000000008', '5a000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 1200, (now() - interval '50 days')::date, null),
  ('5c000000-0000-4000-8000-000000000009', '5a000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 1500, (now() - interval '30 days')::date, null),
  ('5c000000-0000-4000-8000-000000000010', '5a000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 1200, (now() - interval '20 days')::date, 'Freelance check cleared'),

  -- House down payment: $4,200 so far
  ('5c000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000002',
   '11111111-1111-1111-1111-111111111111', 1200, (now() - interval '75 days')::date, null),
  ('5c000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000002',
   '22222222-2222-2222-2222-222222222222', 1200, (now() - interval '45 days')::date, null),
  ('5c000000-0000-4000-8000-000000000013', '5a000000-0000-4000-8000-000000000002',
   '11111111-1111-1111-1111-111111111111', 1200, (now() - interval '15 days')::date, null),
  ('5c000000-0000-4000-8000-000000000014', '5a000000-0000-4000-8000-000000000002',
   '22222222-2222-2222-2222-222222222222', 600, (now() - interval '10 days')::date, 'Extra from side project'),

  -- Japan trip: $1,050 so far
  ('5c000000-0000-4000-8000-000000000015', '5a000000-0000-4000-8000-000000000003',
   '22222222-2222-2222-2222-222222222222', 400, (now() - interval '55 days')::date, null),
  ('5c000000-0000-4000-8000-000000000016', '5a000000-0000-4000-8000-000000000003',
   '11111111-1111-1111-1111-111111111111', 350, (now() - interval '25 days')::date, null),
  ('5c000000-0000-4000-8000-000000000017', '5a000000-0000-4000-8000-000000000003',
   '22222222-2222-2222-2222-222222222222', 300, (now() - interval '5 days')::date, null),

  -- Jamie's private laptop fund: $550 so far
  ('5c000000-0000-4000-8000-000000000018', '5a000000-0000-4000-8000-000000000004',
   '22222222-2222-2222-2222-222222222222', 300, (now() - interval '40 days')::date, null),
  ('5c000000-0000-4000-8000-000000000019', '5a000000-0000-4000-8000-000000000004',
   '22222222-2222-2222-2222-222222222222', 250, (now() - interval '12 days')::date, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Investments (4 portfolios + 2 watchlist items) & holdings
-- ---------------------------------------------------------------------------

insert into public.investments
  (id, workspace_id, owner_id, name, asset_class, account_name, risk_level,
   visibility, is_watchlist, research_notes, notes)
values
  ('10000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Total market index (VTI)', 'etf',
   'Fidelity brokerage', 'medium', 'shared', false, null, 'Core long-term holding.'),
  ('10000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Apple shares', 'stocks',
   'Fidelity brokerage', 'high', 'shared', false, null, null),
  ('10000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Crypto experiment', 'crypto',
   'Coinbase', 'high', 'household', false, null,
   'Small shared position — agreed to cap it at 2% of net worth.'),
  ('10000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '401(k) — Meridian Labs', 'retirement',
   'Fidelity 401(k)', 'medium', 'shared', false, null, 'Contributing 8% with a 4% employer match.'),
  -- Watchlist items (research only, no holdings yet)
  ('10000000-0000-4000-8000-000000000005', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'International index (SCHF)', 'etf',
   null, 'medium', 'shared', true,
   'We are almost entirely US-weighted. Adding ~15% international could smooth things out. Compare expense ratios: SCHF 0.06% vs VXUS 0.07%.', null),
  ('10000000-0000-4000-8000-000000000006', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Series I savings bonds', 'other',
   null, 'low', 'shared', true,
   'Inflation-linked, state-tax free. Could hold part of the emergency fund once we pass 3 months of expenses in cash.', null)
on conflict (id) do nothing;

insert into public.investment_holdings
  (id, investment_id, symbol, name, quantity, cost_basis, current_value, as_of)
values
  ('1d000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'VTI', 'Vanguard Total Stock Market ETF', 42, 9450, 11880, (now() - interval '3 days')::date),
  ('1d000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   'AAPL', 'Apple Inc.', 14, 2380, 3120, (now() - interval '3 days')::date),
  ('1d000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
   'BTC', 'Bitcoin', 0.048, 1900, 2410, (now() - interval '2 days')::date),
  ('1d000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004',
   null, 'Target Retirement 2055 Fund', null, 31200, 38400, (now() - interval '7 days')::date)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. Debts & payments
-- ---------------------------------------------------------------------------

insert into public.debts
  (id, workspace_id, owner_id, name, debt_type, balance, original_balance,
   apr, minimum_payment, due_day, visibility, status, notes)
values
  ('de000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Student loan', 'student_loan', 18200, 24000,
   5.4, 220, 15, 'shared', 'active', 'Federal consolidation loan.'),
  ('de000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Sapphire credit card', 'credit_card', 3100, null,
   22.99, 90, 22, 'shared', 'active', 'Paying this down first — highest rate.'),
  ('de000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Car loan (Subaru)', 'car_loan', 12800, 19500,
   6.9, 310, 5, 'household', 'active', null)
on conflict (id) do nothing;

insert into public.debt_payments (id, debt_id, user_id, amount, paid_on, note)
values
  ('dd000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 220, (now() - interval '65 days')::date, null),
  ('dd000000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 220, (now() - interval '35 days')::date, null),
  ('dd000000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 220, (now() - interval '5 days')::date, null),
  ('dd000000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000002',
   '11111111-1111-1111-1111-111111111111', 250, (now() - interval '40 days')::date, null),
  ('dd000000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000002',
   '11111111-1111-1111-1111-111111111111', 400, (now() - interval '10 days')::date, 'Extra payment toward the balance'),
  ('dd000000-0000-4000-8000-000000000006', 'de000000-0000-4000-8000-000000000003',
   '11111111-1111-1111-1111-111111111111', 310, (now() - interval '63 days')::date, null),
  ('dd000000-0000-4000-8000-000000000007', 'de000000-0000-4000-8000-000000000003',
   '22222222-2222-2222-2222-222222222222', 310, (now() - interval '33 days')::date, null),
  ('dd000000-0000-4000-8000-000000000008', 'de000000-0000-4000-8000-000000000003',
   '11111111-1111-1111-1111-111111111111', 310, (now() - interval '3 days')::date, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 10. Research hub (3 items + comments on the rent-vs-buy discussion)
-- ---------------------------------------------------------------------------

insert into public.research_items
  (id, workspace_id, created_by, title, decision_type, notes, pros, cons,
   estimated_cost, final_decision, status, visibility, decided_at, created_at)
values
  ('4e000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Should we buy a place next year?', 'rent_vs_buy',
   'Rent is $2,400/mo and rising ~4%/yr. A comparable 2BR condo runs $520k. With 15% down we''d need ~$78k plus closing costs.',
   array[
     'Builds equity instead of paying rent',
     'Fixed payment protects us from rent increases',
     'We can finally get a dog without landlord rules',
     'Interest rates may drop — we could refinance later'
   ],
   array[
     'Down payment would drain most of our savings',
     'Maintenance, HOA, and taxes add ~$900/mo over rent',
     'Less flexibility if either of us changes jobs',
     'Market feels near a local peak'
   ],
   80000, null, 'discussing', 'shared', null, now() - interval '30 days'),
  ('4e000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Extra $500/mo: pay down debt or invest?', 'debt_vs_invest',
   'Once the credit card is gone, should the freed-up cash go to the student loan (5.4%) or the brokerage account? Expected market return assumption: 6-7% long-term, not guaranteed.',
   array['Guaranteed 5.4% "return" by paying the loan', 'One less monthly obligation sooner'],
   array['Historically markets have returned more than 5.4%', 'Loan interest may be partially tax-deductible'],
   null, null, 'researching', 'shared', null, now() - interval '18 days'),
  ('4e000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'How big should our emergency fund be?', 'emergency_fund_size',
   'Essential expenses run about $5,000/mo. Options considered: 3 months ($15k), 6 months ($30k), 9 months ($45k).',
   array['Both incomes are salaried and fairly stable', 'We have family we could lean on briefly'],
   array['Jamie''s freelance income varies', 'One car repair + one vet bill wiped out a month once'],
   30000, 'Six months of essentials — $30,000 in the joint high-yield savings account. Revisit after we buy a home.',
   'decided', 'shared', now() - interval '24 days', now() - interval '45 days')
on conflict (id) do nothing;

insert into public.research_comments (id, research_item_id, user_id, body, created_at)
values
  ('4c000000-0000-4000-8000-000000000001', '4e000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222',
   'I ran the numbers with the NYT rent-vs-buy calculator — at 4% rent growth, buying breaks even around year 6. Are we staying that long?',
   now() - interval '28 days'),
  ('4c000000-0000-4000-8000-000000000002', '4e000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'Honestly? I think yes. Both our jobs are hybrid now and we love the neighborhood.',
   now() - interval '27 days'),
  ('4c000000-0000-4000-8000-000000000003', '4e000000-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222',
   'Then let''s keep the house fund on autopilot and get pre-approval quotes so we know our real budget. No pressure to decide this month.',
   now() - interval '26 days'),
  ('4c000000-0000-4000-8000-000000000004', '4e000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'Deal. I added a task to compare pre-approval rates from three lenders.',
   now() - interval '25 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 11. Money check-ins: last month completed + this month drafted
-- ---------------------------------------------------------------------------

insert into public.money_checkins
  (id, workspace_id, month, title, status, scheduled_for, summary, action_items,
   created_by, completed_at, created_at)
values
  ('c1000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   (date_trunc('month', now()) - interval '1 month')::date,
   'Monthly money check-in', 'completed',
   (now() - interval '25 days')::date,
   'A good month overall. Spending on dining was higher than planned, and that''s okay — we agreed to try two home-cooked "date nights" this month. Emergency fund is on track to hit $15k next month. We decided the emergency fund target together (6 months) and closed that research item.',
   jsonb_build_array(
     jsonb_build_object(
       'id', 'ai-1',
       'text', 'Set up automatic $500 transfer to the emergency fund on payday',
       'assigned_to', '11111111-1111-1111-1111-111111111111',
       'done', true
     ),
     jsonb_build_object(
       'id', 'ai-2',
       'text', 'Get two quotes for bundling car + renters insurance',
       'assigned_to', '22222222-2222-2222-2222-222222222222',
       'done', false
     )
   ),
   '11111111-1111-1111-1111-111111111111',
   now() - interval '25 days',
   now() - interval '32 days'),
  ('c1000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   date_trunc('month', now())::date,
   'Monthly money check-in', 'draft',
   (now() + interval '5 days')::date,
   null, '[]'::jsonb,
   '22222222-2222-2222-2222-222222222222',
   null, now() - interval '2 days')
on conflict (id) do nothing;

-- Both partners answered last month's check-in; everything is revealed.
insert into public.checkin_answers
  (checkin_id, user_id, prompt_key, answer, is_revealed, created_at, updated_at)
values
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'wins',
   'We stayed under the grocery budget for the first time, and I finally set up the extra credit card payment.',
   true, now() - interval '27 days', now() - interval '25 days'),
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'concerns',
   'The credit card balance still stresses me out a little. I''d feel better with a clear payoff date.',
   true, now() - interval '27 days', now() - interval '25 days'),
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'upcoming',
   'Car registration renewal and Miso''s annual shots are both due next month.',
   true, now() - interval '27 days', now() - interval '25 days'),
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'commitments',
   'Automate the emergency fund transfer so we stop deciding it manually every month.',
   true, now() - interval '27 days', now() - interval '25 days'),
  ('c1000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'wins',
   'My freelance project paid out and most of it went straight to savings. Felt great.',
   true, now() - interval '26 days', now() - interval '25 days'),
  ('c1000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'concerns',
   'Dining out crept up again. Not blaming either of us — I just want us to plan it instead of defaulting to it.',
   true, now() - interval '26 days', now() - interval '25 days'),
  ('c1000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'upcoming',
   'My sister''s wedding travel — flights will be around $450 for both of us if we book early.',
   true, now() - interval '26 days', now() - interval '25 days'),
  ('c1000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'commitments',
   'Two home-cooked date nights instead of restaurants, and I''ll get the insurance bundle quotes.',
   true, now() - interval '26 days', now() - interval '25 days')
on conflict (checkin_id, user_id, prompt_key) do nothing;

-- ---------------------------------------------------------------------------
-- 12. Documents (metadata only — no files are uploaded by this seed, so
--     download links will 404 until you upload something at these paths)
-- ---------------------------------------------------------------------------

insert into public.documents
  (id, workspace_id, owner_id, name, category, storage_path, file_size, mime_type,
   visibility, expires_on, reminder_on, notes)
values
  ('d0000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Renters insurance policy', 'insurance',
   '33333333-3333-3333-3333-333333333333/11111111-1111-1111-1111-111111111111/renters-insurance-policy.pdf',
   482133, 'application/pdf', 'shared',
   (now() + interval '8 months')::date, (now() + interval '7 months')::date,
   'Policy #RH-2214. Covers both of us.'),
  ('d0000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Tax return (last year)', 'tax',
   '33333333-3333-3333-3333-333333333333/22222222-2222-2222-2222-222222222222/tax-return-last-year.pdf',
   1204551, 'application/pdf', 'shared', null, null, 'Filed jointly.'),
  ('d0000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'Car loan agreement', 'loan',
   '33333333-3333-3333-3333-333333333333/11111111-1111-1111-1111-111111111111/car-loan-agreement.pdf',
   356902, 'application/pdf', 'household', null, null, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 13. Tasks (5, mixed statuses and assignees)
-- ---------------------------------------------------------------------------

insert into public.tasks
  (id, workspace_id, created_by, assigned_to, title, description, due_on,
   status, priority, related_type, related_id, completed_at, created_at)
values
  ('7a000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'Rebalance 401(k) contributions', 'Bump contribution from 8% to 10% before open enrollment closes.',
   (now() + interval '12 days')::date, 'open', 'high',
   'investment', '10000000-0000-4000-8000-000000000004', null, now() - interval '8 days'),
  ('7a000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Get insurance bundle quotes', 'Car + renters bundle — from our check-in action items. Two quotes minimum.',
   (now() + interval '7 days')::date, 'in_progress', 'medium',
   'checkin', 'c1000000-0000-4000-8000-000000000001', null, now() - interval '20 days'),
  ('7a000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Set up automatic emergency fund transfer', '$500 on each payday into the joint savings account.',
   null, 'done', 'high',
   'goal', '5a000000-0000-4000-8000-000000000001', now() - interval '10 days', now() - interval '24 days'),
  ('7a000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Compare mortgage pre-approval rates', 'Three lenders: our bank, a credit union, and an online broker.',
   (now() + interval '14 days')::date, 'open', 'medium',
   'research', '4e000000-0000-4000-8000-000000000001', null, now() - interval '25 days'),
  ('7a000000-0000-4000-8000-000000000005', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Cancel unused fitness app subscription', 'We have not opened it since March — $12.99/mo back in the budget.',
   null, 'done', 'low', null, null, now() - interval '16 days', now() - interval '18 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 14. Activity feed (~16 events telling the last three months' story)
-- ---------------------------------------------------------------------------

insert into public.activity_events
  (id, workspace_id, actor_id, event_type, entity_type, entity_id, summary, metadata, visibility, created_at)
values
  ('ae000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'workspace.created', 'workspace', '33333333-3333-3333-3333-333333333333',
   'Alex created the workspace "Alex & Jamie"', '{}', 'shared', now() - interval '90 days'),
  ('ae000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'member.joined', 'workspace', '33333333-3333-3333-3333-333333333333',
   'Jamie accepted the invite and joined the workspace', '{}', 'shared', now() - interval '89 days'),
  ('ae000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'account.created', 'account', 'ac000000-0000-4000-8000-000000000001',
   'Alex added the account "Joint checking"', '{"balance": 8450}', 'shared', now() - interval '88 days'),
  ('ae000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'goal.created', 'goal', '5a000000-0000-4000-8000-000000000001',
   'Alex created the goal "Emergency fund" ($30,000 target)', '{"target_amount": 30000}', 'shared', now() - interval '85 days'),
  ('ae000000-0000-4000-8000-000000000005', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'goal.created', 'goal', '5a000000-0000-4000-8000-000000000002',
   'Alex created the goal "House down payment" ($80,000 target)', '{"target_amount": 80000}', 'shared', now() - interval '84 days'),
  ('ae000000-0000-4000-8000-000000000006', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'debt.created', 'debt', 'de000000-0000-4000-8000-000000000001',
   'Jamie added the debt "Student loan" ($18,200 at 5.4% APR)', '{"balance": 18200}', 'shared', now() - interval '80 days'),
  ('ae000000-0000-4000-8000-000000000007', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'expense.created', 'expense', 'e0000000-0000-4000-8000-000000000002',
   'Alex logged the recurring expense "Rent" ($2,400)', '{"amount": 2400}', 'shared', now() - interval '34 days'),
  ('ae000000-0000-4000-8000-000000000008', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'goal.contribution_added', 'goal', '5a000000-0000-4000-8000-000000000001',
   'Jamie added $1,200 to "Emergency fund"', '{"amount": 1200}', 'shared', now() - interval '20 days'),
  ('ae000000-0000-4000-8000-000000000009', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'checkin.completed', 'checkin', 'c1000000-0000-4000-8000-000000000001',
   'Alex and Jamie completed last month''s money check-in', '{}', 'shared', now() - interval '25 days'),
  ('ae000000-0000-4000-8000-000000000010', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'research.decided', 'research', '4e000000-0000-4000-8000-000000000003',
   'Decision made: emergency fund target is six months of essentials ($30,000)', '{}', 'shared', now() - interval '24 days'),
  ('ae000000-0000-4000-8000-000000000011', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'debt.payment_recorded', 'debt', 'de000000-0000-4000-8000-000000000001',
   'Jamie recorded a $220 payment on "Student loan"', '{"amount": 220}', 'shared', now() - interval '5 days'),
  ('ae000000-0000-4000-8000-000000000012', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'document.uploaded', 'document', 'd0000000-0000-4000-8000-000000000002',
   'Jamie added the document "Tax return (last year)"', '{}', 'shared', now() - interval '12 days'),
  ('ae000000-0000-4000-8000-000000000013', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'task.completed', 'task', '7a000000-0000-4000-8000-000000000003',
   'Alex completed the task "Set up automatic emergency fund transfer"', '{}', 'shared', now() - interval '10 days'),
  ('ae000000-0000-4000-8000-000000000014', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'expense.created', 'expense', 'e0000000-0000-4000-8000-000000000036',
   'Alex logged the expense "Vet visit — Miso''s checkup" ($185)', '{"amount": 185}', 'shared', now() - interval '15 days'),
  ('ae000000-0000-4000-8000-000000000015', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'debt.payment_recorded', 'debt', 'de000000-0000-4000-8000-000000000002',
   'Alex recorded a $400 payment on "Sapphire credit card"', '{"amount": 400}', 'shared', now() - interval '10 days'),
  -- Private event: only Jamie ever sees this one.
  ('ae000000-0000-4000-8000-000000000016', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'expense.created', 'expense', 'e0000000-0000-4000-8000-000000000039',
   'Jamie logged a private expense', '{}', 'private', now() - interval '6 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 15. Notifications (3 per user, 1 unread each)
-- ---------------------------------------------------------------------------

insert into public.notifications
  (id, user_id, workspace_id, type, title, body, link, is_read, created_at)
values
  -- Alex
  ('0f000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'checkin.scheduled',
   'Jamie scheduled this month''s check-in',
   'Your money check-in is planned for later this week. Add your answers whenever you''re ready.',
   '/check-ins/c1000000-0000-4000-8000-000000000002', false, now() - interval '2 days'),
  ('0f000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'goal.contribution',
   'Jamie added $1,200 to Emergency fund',
   'The emergency fund is now about 45% of the way to its $30,000 target.',
   '/goals/5a000000-0000-4000-8000-000000000001', true, now() - interval '20 days'),
  ('0f000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'comment.added',
   'Jamie commented on "Should we buy a place next year?"',
   '"I ran the numbers with the rent-vs-buy calculator…"',
   '/research/4e000000-0000-4000-8000-000000000001', true, now() - interval '28 days'),
  -- Jamie
  ('0f000000-0000-4000-8000-000000000004', '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333', 'task.assigned',
   'Alex assigned you a task',
   '"Rebalance 401(k) contributions" — due in about two weeks.',
   '/tasks', false, now() - interval '8 days'),
  ('0f000000-0000-4000-8000-000000000005', '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333', 'debt.payment',
   'Alex recorded a $400 payment on Sapphire credit card',
   'The balance is down to $3,100.',
   '/debts', true, now() - interval '10 days'),
  ('0f000000-0000-4000-8000-000000000006', '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333', 'comment.added',
   'Alex commented on "Student loan"',
   '"Under $18k soon — steady progress."',
   '/debts', true, now() - interval '14 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 16. Comments on goals & debts
-- ---------------------------------------------------------------------------

insert into public.comments (id, workspace_id, user_id, entity_type, entity_id, body, created_at)
values
  ('c0000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'goal', '5a000000-0000-4000-8000-000000000001',
   'Almost halfway there! The automatic transfer was such a good idea.', now() - interval '19 days'),
  ('c0000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'goal', '5a000000-0000-4000-8000-000000000002',
   'Talked to the credit union — pre-approval is a soft pull, so no downside to getting a quote.', now() - interval '13 days'),
  ('c0000000-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'debt', 'de000000-0000-4000-8000-000000000001',
   'Under $18k soon — steady progress. Want to celebrate when it crosses?', now() - interval '14 days'),
  ('c0000000-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'debt', 'de000000-0000-4000-8000-000000000003',
   'Idea: if we get a tax refund, should part of it go to the car loan? Worth discussing at the next check-in.', now() - interval '7 days')
on conflict (id) do nothing;

commit;
