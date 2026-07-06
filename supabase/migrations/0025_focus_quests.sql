-- =====================================================================
-- Foco do dia — quest diária opt-in. Uma linha por quest criada.
-- =====================================================================
-- RLS own-row (espelha touvi_messages/user_reminders). update = finalizar
-- (seta completed_at); delete = descartar. Rodar no SQL Editor do Supabase.
create table public.focus_quests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  text         text not null,
  prompt       text not null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.focus_quests enable row level security;
create index focus_quests_user_idx on public.focus_quests(user_id, started_at);

create policy "own select" on public.focus_quests for select using (auth.uid() = user_id);
create policy "own insert" on public.focus_quests for insert with check (auth.uid() = user_id);
create policy "own update" on public.focus_quests for update using (auth.uid() = user_id);
create policy "own delete" on public.focus_quests for delete using (auth.uid() = user_id);

-- Preferência opt-in da feature (default desligado).
alter table public.profiles
  add column focus_quest_enabled boolean not null default false;
