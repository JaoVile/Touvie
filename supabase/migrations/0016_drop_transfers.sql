-- 0016 — Remove a tabela `transfers` (órfã desde o modelo "um total só").
--
-- A transferência entre contas foi removida da UI no commit 0b0efc1. A tabela
-- ficou sem nenhum caminho de escrita e, verificado em 2026-06-04, está VAZIA
-- (0 linhas) — então dropar não afeta o saldo de ninguém.
--
-- A view finance_account_balances ainda somava `transfers` em dois subselects
-- (que retornavam 0). Recriamos a view sem esses termos ANTES do drop, senão o
-- DROP TABLE falharia por dependência.

-- 1. View de saldo sem os termos de transferência -----------------------
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
    as current_cents
from public.finance_accounts a;

-- 2. Drop da tabela órfã (RLS/policies/índice caem junto) ----------------
drop table if exists public.transfers;
