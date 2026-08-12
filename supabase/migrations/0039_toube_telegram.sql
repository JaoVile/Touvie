-- 0039: Toube no Telegram — sessão marcada por origem e propostas pendentes.

alter table public.toube_sessions
  add column source text not null default 'web' check (source in ('web','telegram'));

-- Uma sessão de Telegram por usuário (o webhook resolve sempre a mesma).
create unique index toube_sessions_telegram_uniq
  on public.toube_sessions(user_id) where source = 'telegram';

-- Proposta aguardando confirmação por botão. O callback_data do Telegram tem
-- teto de 64 bytes, então o botão carrega só o id e a proposta mora aqui.
create table public.toube_pending_proposals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  chat_id     text not null,
  message_id  bigint,
  proposals   jsonb not null,
  consumed_at timestamptz,
  expires_at  timestamptz not null default now() + interval '1 hour',
  created_at  timestamptz not null default now()
);
alter table public.toube_pending_proposals enable row level security;
create index toube_pending_proposals_user_idx
  on public.toube_pending_proposals(user_id, created_at desc);
create policy "own select" on public.toube_pending_proposals
  for select using (auth.uid() = user_id);
create policy "own delete" on public.toube_pending_proposals
  for delete using (auth.uid() = user_id);
