-- ===========================================================================
-- TogetherWealth — 00002_rls.sql
-- Row Level Security: the backbone of couple privacy.
--
-- Core rules:
--   * Everything is scoped to a workspace the caller is a member of.
--   * visibility = 'private' rows are visible ONLY to their owner — they must
--     never reach the partner, in any query or aggregate.
--   * Child tables inherit visibility from their parent via EXISTS.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies never recurse into RLS)
-- ---------------------------------------------------------------------------

-- Is the current user a member of the given workspace?
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
  );
$$;

-- Is the current user the OWNER (role) of the given workspace?
create or replace function public.is_workspace_owner(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- Do the current user and `other` share at least one workspace?
create or replace function public.shares_workspace_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members me
    join workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = auth.uid()
      and them.user_id = other
  );
$$;

-- Accept a partner invite. Security definer: the invitee is not yet a member,
-- so this is the only sanctioned path into workspace_members for partners.
create or replace function public.accept_partner_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.partner_invites%rowtype;
  jwt_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select * into inv
  from public.partner_invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'This invite link is not valid.';
  end if;

  if inv.status <> 'pending' then
    raise exception 'This invite is no longer active.';
  end if;

  if inv.expires_at < now() then
    update public.partner_invites set status = 'expired' where id = inv.id;
    raise exception 'This invite has expired. Ask your partner to send a new one.';
  end if;

  if lower(inv.email) <> jwt_email then
    raise exception 'This invite was sent to a different email address. Sign in with the invited email to accept it.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), 'partner')
  on conflict (workspace_id, user_id) do nothing;

  update public.partner_invites
  set status = 'accepted', accepted_at = now()
  where id = inv.id;

  return inv.workspace_id;
end;
$$;

-- Lock function execution down to signed-in users.
revoke execute on function public.accept_partner_invite(text) from public, anon;
grant execute on function public.accept_partner_invite(text) to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere + strip anon table access entirely
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.couple_workspaces   enable row level security;
alter table public.workspace_members   enable row level security;
alter table public.partner_invites     enable row level security;
alter table public.accounts            enable row level security;
alter table public.income_sources      enable row level security;
alter table public.expenses            enable row level security;
alter table public.expense_splits      enable row level security;
alter table public.budgets             enable row level security;
alter table public.savings_goals       enable row level security;
alter table public.goal_contributions  enable row level security;
alter table public.investments         enable row level security;
alter table public.investment_holdings enable row level security;
alter table public.debts               enable row level security;
alter table public.debt_payments       enable row level security;
alter table public.research_items      enable row level security;
alter table public.research_comments   enable row level security;
alter table public.money_checkins      enable row level security;
alter table public.checkin_answers     enable row level security;
alter table public.documents           enable row level security;
alter table public.tasks               enable row level security;
alter table public.activity_events     enable row level security;
alter table public.notifications       enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.comments            enable row level security;
alter table public.approvals           enable row level security;

revoke all on all tables in schema public from anon;

-- Billing rows are written only by the server (service role) — remove even the
-- underlying grants so no future policy can accidentally open them up.
revoke insert, update, delete on public.subscriptions from authenticated;

-- The activity feed is append-only for clients.
revoke update, delete on public.activity_events from authenticated;

-- ---------------------------------------------------------------------------
-- profiles: see yourself and anyone you share a workspace with; edit only self
-- ---------------------------------------------------------------------------

create policy "profiles_select_self_or_partner" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_workspace_with(id));

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- couple_workspaces: members read/update; creator sees own insert (RETURNING
-- runs before the membership trigger is observable); owner role deletes.
-- ---------------------------------------------------------------------------

create policy "workspaces_select_members" on public.couple_workspaces
  for select to authenticated
  using (public.is_workspace_member(id) or created_by = auth.uid());

create policy "workspaces_insert_creator" on public.couple_workspaces
  for insert to authenticated
  with check (created_by = auth.uid());

-- Money style / split changes are allowed at the DB layer; the app layer
-- routes them through the approvals flow.
create policy "workspaces_update_members" on public.couple_workspaces
  for update to authenticated
  using (public.is_workspace_member(id))
  with check (public.is_workspace_member(id));

create policy "workspaces_delete_owner" on public.couple_workspaces
  for delete to authenticated
  using (public.is_workspace_owner(id));

-- ---------------------------------------------------------------------------
-- workspace_members: partners join ONLY via accept_partner_invite (definer).
-- Direct insert is limited to the workspace creator adding themselves
-- (normally handled by the on_workspace_created trigger anyway).
-- ---------------------------------------------------------------------------

create policy "members_select_co_members" on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members_insert_creator_self" on public.workspace_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.couple_workspaces w
      where w.id = workspace_id and w.created_by = auth.uid()
    )
  );

-- Leave a workspace yourself, or the owner may remove a member.
create policy "members_delete_self_or_owner" on public.workspace_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_workspace_owner(workspace_id));

-- ---------------------------------------------------------------------------
-- partner_invites: managed by workspace members; the invitee may read their
-- own invite by email so the accept page can render it pre-membership.
-- ---------------------------------------------------------------------------

create policy "invites_select_members" on public.partner_invites
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "invites_select_invitee" on public.partner_invites
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "invites_insert_members" on public.partner_invites
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and invited_by = auth.uid());

create policy "invites_update_members" on public.partner_invites
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "invites_delete_members" on public.partner_invites
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- accounts (owner column: owner_id)
-- ---------------------------------------------------------------------------

create policy "accounts_select" on public.accounts
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or owner_id = auth.uid())
  );

create policy "accounts_insert" on public.accounts
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and owner_id = auth.uid());

create policy "accounts_update" on public.accounts
  for update to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

create policy "accounts_delete" on public.accounts
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- income_sources (owner column: owner_id)
-- ---------------------------------------------------------------------------

create policy "income_select" on public.income_sources
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or owner_id = auth.uid())
  );

create policy "income_insert" on public.income_sources
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and owner_id = auth.uid());

create policy "income_update" on public.income_sources
  for update to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

create policy "income_delete" on public.income_sources
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- expenses (owner columns: created_by OR paid_by)
-- ---------------------------------------------------------------------------

create policy "expenses_select" on public.expenses
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (
      visibility <> 'private'
      or created_by = auth.uid()
      or paid_by = auth.uid()
    )
  );

create policy "expenses_insert" on public.expenses
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "expenses_update" on public.expenses
  for update to authenticated
  using (
    created_by = auth.uid()
    or paid_by = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

create policy "expenses_delete" on public.expenses
  for delete to authenticated
  using (
    created_by = auth.uid()
    or paid_by = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- expense_splits: inherit the parent expense's visibility
-- ---------------------------------------------------------------------------

create policy "splits_select" on public.expense_splits
  for select to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_workspace_member(e.workspace_id)
        and (
          e.visibility <> 'private'
          or e.created_by = auth.uid()
          or e.paid_by = auth.uid()
        )
    )
  );

create policy "splits_insert" on public.expense_splits
  for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_workspace_member(e.workspace_id)
        and (
          e.created_by = auth.uid()
          or e.paid_by = auth.uid()
          or (e.visibility = 'household')
        )
    )
  );

-- Update: whoever can edit the parent expense, or the split's own user
-- (settling their share).
create policy "splits_update" on public.expense_splits
  for update to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_workspace_member(e.workspace_id)
        and (
          e.created_by = auth.uid()
          or e.paid_by = auth.uid()
          or e.visibility = 'household'
          or user_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_workspace_member(e.workspace_id)
    )
  );

create policy "splits_delete" on public.expense_splits
  for delete to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_workspace_member(e.workspace_id)
        and (
          e.created_by = auth.uid()
          or e.paid_by = auth.uid()
          or e.visibility = 'household'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- budgets (owner column: owner_id, null = household budget)
-- ---------------------------------------------------------------------------

create policy "budgets_select" on public.budgets
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or owner_id = auth.uid())
  );

create policy "budgets_insert" on public.budgets
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and (owner_id is null or owner_id = auth.uid())
  );

-- Household budgets (owner_id null) are jointly managed by members.
create policy "budgets_update" on public.budgets
  for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (owner_id = auth.uid() or owner_id is null or visibility = 'household')
  )
  with check (public.is_workspace_member(workspace_id));

create policy "budgets_delete" on public.budgets
  for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (owner_id = auth.uid() or owner_id is null or visibility = 'household')
  );

-- ---------------------------------------------------------------------------
-- savings_goals (owner column: created_by)
-- ---------------------------------------------------------------------------

create policy "goals_select" on public.savings_goals
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or created_by = auth.uid())
  );

create policy "goals_insert" on public.savings_goals
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "goals_update" on public.savings_goals
  for update to authenticated
  using (
    created_by = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

create policy "goals_delete" on public.savings_goals
  for delete to authenticated
  using (
    created_by = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- goal_contributions: inherit the parent goal's visibility
-- ---------------------------------------------------------------------------

create policy "contributions_select" on public.goal_contributions
  for select to authenticated
  using (
    exists (
      select 1 from public.savings_goals g
      where g.id = goal_id
        and public.is_workspace_member(g.workspace_id)
        and (g.visibility <> 'private' or g.created_by = auth.uid())
    )
  );

create policy "contributions_insert" on public.goal_contributions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.savings_goals g
      where g.id = goal_id
        and public.is_workspace_member(g.workspace_id)
        and (g.visibility <> 'private' or g.created_by = auth.uid())
    )
  );

create policy "contributions_update_own" on public.goal_contributions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "contributions_delete_own" on public.goal_contributions
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- investments (owner column: owner_id)
-- ---------------------------------------------------------------------------

create policy "investments_select" on public.investments
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or owner_id = auth.uid())
  );

create policy "investments_insert" on public.investments
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and owner_id = auth.uid());

create policy "investments_update" on public.investments
  for update to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

create policy "investments_delete" on public.investments
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- investment_holdings: inherit the parent investment's visibility
-- ---------------------------------------------------------------------------

create policy "holdings_select" on public.investment_holdings
  for select to authenticated
  using (
    exists (
      select 1 from public.investments i
      where i.id = investment_id
        and public.is_workspace_member(i.workspace_id)
        and (i.visibility <> 'private' or i.owner_id = auth.uid())
    )
  );

create policy "holdings_insert" on public.investment_holdings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.investments i
      where i.id = investment_id
        and public.is_workspace_member(i.workspace_id)
        and (i.owner_id = auth.uid() or i.visibility = 'household')
    )
  );

create policy "holdings_update" on public.investment_holdings
  for update to authenticated
  using (
    exists (
      select 1 from public.investments i
      where i.id = investment_id
        and public.is_workspace_member(i.workspace_id)
        and (i.owner_id = auth.uid() or i.visibility = 'household')
    )
  )
  with check (
    exists (
      select 1 from public.investments i
      where i.id = investment_id and public.is_workspace_member(i.workspace_id)
    )
  );

create policy "holdings_delete" on public.investment_holdings
  for delete to authenticated
  using (
    exists (
      select 1 from public.investments i
      where i.id = investment_id
        and public.is_workspace_member(i.workspace_id)
        and (i.owner_id = auth.uid() or i.visibility = 'household')
    )
  );

-- ---------------------------------------------------------------------------
-- debts (owner column: owner_id)
-- ---------------------------------------------------------------------------

create policy "debts_select" on public.debts
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or owner_id = auth.uid())
  );

create policy "debts_insert" on public.debts
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and owner_id = auth.uid());

create policy "debts_update" on public.debts
  for update to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

create policy "debts_delete" on public.debts
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- debt_payments: inherit the parent debt's visibility
-- ---------------------------------------------------------------------------

create policy "debt_payments_select" on public.debt_payments
  for select to authenticated
  using (
    exists (
      select 1 from public.debts d
      where d.id = debt_id
        and public.is_workspace_member(d.workspace_id)
        and (d.visibility <> 'private' or d.owner_id = auth.uid())
    )
  );

create policy "debt_payments_insert" on public.debt_payments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.debts d
      where d.id = debt_id
        and public.is_workspace_member(d.workspace_id)
        and (d.visibility <> 'private' or d.owner_id = auth.uid())
    )
  );

create policy "debt_payments_update_own" on public.debt_payments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "debt_payments_delete_own" on public.debt_payments
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- research_items (owner column: created_by)
-- ---------------------------------------------------------------------------

create policy "research_select" on public.research_items
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or created_by = auth.uid())
  );

create policy "research_insert" on public.research_items
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "research_update" on public.research_items
  for update to authenticated
  using (
    created_by = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

create policy "research_delete" on public.research_items
  for delete to authenticated
  using (
    created_by = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- research_comments: inherit the parent research item's visibility
-- ---------------------------------------------------------------------------

create policy "research_comments_select" on public.research_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.research_items r
      where r.id = research_item_id
        and public.is_workspace_member(r.workspace_id)
        and (r.visibility <> 'private' or r.created_by = auth.uid())
    )
  );

create policy "research_comments_insert" on public.research_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.research_items r
      where r.id = research_item_id
        and public.is_workspace_member(r.workspace_id)
        and (r.visibility <> 'private' or r.created_by = auth.uid())
    )
  );

create policy "research_comments_update_own" on public.research_comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "research_comments_delete_own" on public.research_comments
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- money_checkins: workspace-scoped (no visibility column) — a shared ritual
-- ---------------------------------------------------------------------------

create policy "checkins_select_members" on public.money_checkins
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "checkins_insert_members" on public.money_checkins
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "checkins_update_members" on public.money_checkins
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "checkins_delete_members" on public.money_checkins
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- checkin_answers: you always see your own; the partner's ONLY once revealed.
-- ---------------------------------------------------------------------------

create policy "answers_select_own_or_revealed" on public.checkin_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.money_checkins c
      where c.id = checkin_id and public.is_workspace_member(c.workspace_id)
    )
    and (user_id = auth.uid() or is_revealed = true)
  );

create policy "answers_insert_own" on public.checkin_answers
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.money_checkins c
      where c.id = checkin_id and public.is_workspace_member(c.workspace_id)
    )
  );

create policy "answers_update_own" on public.checkin_answers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "answers_delete_own" on public.checkin_answers
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- documents (owner column: owner_id) — metadata; files live in storage
-- ---------------------------------------------------------------------------

create policy "documents_select" on public.documents
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or owner_id = auth.uid())
  );

create policy "documents_insert" on public.documents
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and owner_id = auth.uid());

create policy "documents_update" on public.documents
  for update to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

create policy "documents_delete" on public.documents
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or (visibility = 'household' and public.is_workspace_member(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- tasks: workspace-scoped (no visibility column)
-- ---------------------------------------------------------------------------

create policy "tasks_select_members" on public.tasks
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "tasks_insert_members" on public.tasks
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "tasks_update_members" on public.tasks
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "tasks_delete_members" on public.tasks
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- activity_events: append-only feed (owner column: actor_id)
-- ---------------------------------------------------------------------------

create policy "activity_select" on public.activity_events
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (visibility <> 'private' or actor_id = auth.uid())
  );

create policy "activity_insert" on public.activity_events
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

-- No update/delete policies: the feed is immutable for clients
-- (grants were also revoked above).

-- ---------------------------------------------------------------------------
-- notifications: yours to read/manage; a workspace co-member may create one
-- for you (e.g. "your partner added an expense").
-- ---------------------------------------------------------------------------

create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_insert_co_member" on public.notifications
  for insert to authenticated
  with check (user_id = auth.uid() or public.shares_workspace_with(user_id));

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- subscriptions: members may read; ALL writes go through the service role
-- (no insert/update/delete policies on purpose; grants revoked above).
-- ---------------------------------------------------------------------------

create policy "subscriptions_select_members" on public.subscriptions
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- comments: workspace-scoped discussion; authors manage their own
-- ---------------------------------------------------------------------------

create policy "comments_select_members" on public.comments
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

create policy "comments_update_own" on public.comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "comments_delete_own" on public.comments
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- approvals: requester creates; only the OTHER partner decides; the
-- requester may cancel their own pending request.
-- ---------------------------------------------------------------------------

create policy "approvals_select_members" on public.approvals
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "approvals_insert_requester" on public.approvals
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and requested_by = auth.uid());

-- Decide: a member who is NOT the requester resolves a pending request.
create policy "approvals_update_decide" on public.approvals
  for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and requested_by <> auth.uid()
    and status = 'pending'
  )
  with check (
    public.is_workspace_member(workspace_id)
    and decided_by = auth.uid()
    and requested_by <> auth.uid()
    and status in ('approved', 'rejected')
  );

-- Cancel: the requester withdraws their own pending request.
create policy "approvals_update_cancel" on public.approvals
  for update to authenticated
  using (requested_by = auth.uid() and status = 'pending')
  with check (
    requested_by = auth.uid()
    and status = 'canceled'
    and decided_by is null
  );
