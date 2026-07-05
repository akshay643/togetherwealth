-- ===========================================================================
-- TogetherWealth — 00005_bill_payments.sql
-- Month-wise paid/unpaid tracking for recurring bills.
-- ===========================================================================

create table if not exists public.bill_payments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  expense_id   uuid not null references public.expenses (id) on delete cascade,
  month        date not null, -- first day of the bill month
  paid_on      date not null,
  amount       numeric(14,2) not null,
  note         text,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (expense_id, month)
);

create index if not exists bill_payments_workspace_month_idx
  on public.bill_payments (workspace_id, month);

create index if not exists bill_payments_expense_id_idx
  on public.bill_payments (expense_id);

alter table public.bill_payments enable row level security;

create policy "bill_payments_select_visible_bills" on public.bill_payments
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and e.workspace_id = bill_payments.workspace_id
        and e.is_recurring = true
        and (e.visibility <> 'private' or e.created_by = auth.uid() or e.paid_by = auth.uid())
    )
  );

create policy "bill_payments_insert_visible_bills" on public.bill_payments
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and e.workspace_id = bill_payments.workspace_id
        and e.is_recurring = true
        and (e.visibility <> 'private' or e.created_by = auth.uid() or e.paid_by = auth.uid())
    )
  );

create policy "bill_payments_update_visible_bills" on public.bill_payments
  for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and e.workspace_id = bill_payments.workspace_id
        and e.is_recurring = true
        and (e.visibility <> 'private' or e.created_by = auth.uid() or e.paid_by = auth.uid())
    )
  )
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and e.workspace_id = bill_payments.workspace_id
        and e.is_recurring = true
        and (e.visibility <> 'private' or e.created_by = auth.uid() or e.paid_by = auth.uid())
    )
  );

create policy "bill_payments_delete_visible_bills" on public.bill_payments
  for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and e.workspace_id = bill_payments.workspace_id
        and e.is_recurring = true
        and (e.visibility <> 'private' or e.created_by = auth.uid() or e.paid_by = auth.uid())
    )
  );

drop trigger if exists set_updated_at on public.bill_payments;
create trigger set_updated_at before update on public.bill_payments
  for each row execute function public.set_updated_at();
