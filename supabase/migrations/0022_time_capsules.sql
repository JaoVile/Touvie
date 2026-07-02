-- 0022 — Cápsulas do tempo ("jogar pro universo").
--
-- Uma carta selada por X tempo: o conteúdo fica invisível até opens_at chegar.
-- Se o diário privado (zero-knowledge) estiver ativo E destrancado na hora de
-- selar, content vai cifrado no formato "enc:v1:<iv>:<ct>" com a MESMA DEK do
-- diário — nem o servidor lê a carta pro futuro. Senão, vai em texto puro
-- (a trava de tempo continua valendo na UI).
--
-- O TÍTULO viaja aberto de propósito: é ele que aparece na lista de "viajando"
-- e no aviso do Telegram quando a cápsula chega (cron diário marca notified_at).

create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null,
  sealed_at timestamptz not null default now(),
  opens_at timestamptz not null,
  opened_at timestamptz,
  notified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.time_capsules enable row level security;

create policy "own select" on public.time_capsules
  for select using (auth.uid() = user_id);
create policy "own insert" on public.time_capsules
  for insert with check (auth.uid() = user_id);
create policy "own update" on public.time_capsules
  for update using (auth.uid() = user_id);
create policy "own delete" on public.time_capsules
  for delete using (auth.uid() = user_id);

-- Varredura do cron: só as que chegaram e ainda não foram avisadas.
create index if not exists time_capsules_due_idx
  on public.time_capsules (opens_at)
  where notified_at is null;

create index if not exists time_capsules_user_idx
  on public.time_capsules (user_id, opens_at);
