-- =====================================================================
-- FINANCE UPGRADE
--   1. transfers (movimentação entre contas, fora de receita/despesa)
--   2. campos de cartão de crédito em finance_accounts
--   3. campos de parcelamento em transactions
--   4. view finance_account_balances (saldo real calculado)
-- =====================================================================

-- 1. TRANSFERS ---------------------------------------------------------
create table if not exists public.transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid references public.finance_accounts(id) on delete set null,
  to_account_id   uuid references public.finance_accounts(id) on delete set null,
  amount_cents    bigint not null check (amount_cents > 0),
  occurred_on     date not null,
  description     text,
  created_at      timestamptz not null default now()
);

create index if not exists transfers_user_date_idx
  on public.transfers(user_id, occurred_on desc);

alter table public.transfers enable row level security;

create policy "own select" on public.transfers for select using (auth.uid() = user_id);
create policy "own insert" on public.transfers for insert with check (auth.uid() = user_id);
create policy "own update" on public.transfers for update using (auth.uid() = user_id);
create policy "own delete" on public.transfers for delete using (auth.uid() = user_id);

-- 2. CARTÃO DE CRÉDITO -------------------------------------------------
-- balance_cents passa a significar "saldo inicial"; o saldo atual vem da view.
alter table public.finance_accounts
  add column if not exists credit_limit_cents bigint,
  add column if not exists closing_day        int,
  add column if not exists due_day            int;

-- 3. PARCELAMENTO ------------------------------------------------------
alter table public.transactions
  add column if not exists installment_total  int,
  add column if not exists installment_number int,
  add column if not exists installment_group_id uuid;

create index if not exists transactions_installment_group_idx
  on public.transactions(installment_group_id);

-- 4. SALDO REAL (view) -------------------------------------------------
-- security_invoker => respeita a RLS das tabelas base (PG15+/Supabase).
create or replace view public.finance_account_balances
with (security_invoker = on) as
select
  a.id      as account_id,
  a.user_id as user_id,
  a.balance_cents
    + coalesce((
        select sum(case when t.kind = 'income' then t.amount_cents else -t.amount_cents end)
        from public.transactions t
        where t.account_id = a.id and t.is_recurring = false
      ), 0)
    + coalesce((
        select sum(tr.amount_cents) from public.transfers tr where tr.to_account_id = a.id
      ), 0)
    - coalesce((
        select sum(tr.amount_cents) from public.transfers tr where tr.from_account_id = a.id
      ), 0)
    as current_cents
from public.finance_accounts a;
