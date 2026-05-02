-- Coluna para deduplicação de importações CSV
alter table public.transactions
  add column if not exists external_ref varchar(80);

-- Índice para checar duplicatas rapidamente por usuário
create index if not exists transactions_user_extref_idx
  on public.transactions(user_id, external_ref)
  where external_ref is not null;
