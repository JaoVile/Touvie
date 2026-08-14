-- 0041: notificações próprias (Web Push).
--
-- Uma linha POR APARELHO, não por usuário: assinatura de push pertence ao
-- navegador, não à conta. Celular e notebook são duas linhas e as duas recebem.
--
-- Idempotente: dá pra rodar de novo se uma tentativa parar no meio.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null unique,   -- identidade da assinatura
  p256dh     text not null,          -- chaves de criptografia do navegador
  auth       text not null,
  user_agent text,                   -- pra reconhecer o aparelho na lista
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
alter table public.push_subscriptions enable row level security;
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

drop policy if exists "own select" on public.push_subscriptions;
create policy "own select" on public.push_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "own insert" on public.push_subscriptions;
create policy "own insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "own delete" on public.push_subscriptions;
create policy "own delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Os dois defaults são `true` de propósito: quem já usa Telegram não perde nada
-- no dia do deploy, e notify_push ligado SEM assinatura não envia nada.
alter table public.profiles
  add column if not exists notify_push     boolean not null default true,
  add column if not exists notify_telegram boolean not null default true;
