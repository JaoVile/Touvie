-- =====================================================================
-- PAGAMENTO DE CONTA → LANÇAMENTO
--   Liga uma transação à bill que ela quitou, para que marcar/desmarcar
--   "paga" crie/remova a despesa real (afetando o saldo) de forma idempotente.
-- =====================================================================

alter table public.transactions
  add column if not exists bill_id uuid references public.bills(id) on delete set null;

create index if not exists transactions_bill_id_idx
  on public.transactions(bill_id) where bill_id is not null;
