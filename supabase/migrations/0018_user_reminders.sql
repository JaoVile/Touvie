-- Lembretes pessoais por área — a origem do disparo agendado (cron-mestre).
-- Cada usuário cria/edita só os seus (RLS); o sweep do cron lê todos via
-- service_role (que ignora RLS). Espelha o tipo ReminderSchedule do front.
create table public.user_reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  area          text not null,
  message       text not null,
  schedule_type text not null check (schedule_type in ('daily', 'weekly', 'interval')),
  at_time       text,                         -- "HH:MM" (daily / weekly)
  days          int[] not null default '{}',  -- 0=Dom … 6=Sáb (weekly)
  every_hours   int,                          -- intervalo em horas (interval)
  window_from   text,                         -- "HH:MM" início da janela (interval)
  window_to     text,                         -- "HH:MM" fim da janela (interval)
  active        boolean not null default true,
  last_fired_at timestamptz,                  -- trava anti-duplicata do sweep
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.user_reminders enable row level security;

create index user_reminders_user_idx on public.user_reminders(user_id, area, created_at desc);
create index user_reminders_active_idx on public.user_reminders(active) where active;

create policy "own select" on public.user_reminders for select using (auth.uid() = user_id);
create policy "own insert" on public.user_reminders for insert with check (auth.uid() = user_id);
create policy "own update" on public.user_reminders for update using (auth.uid() = user_id);
create policy "own delete" on public.user_reminders for delete using (auth.uid() = user_id);

create or replace function public.user_reminders_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger user_reminders_updated_at before update on public.user_reminders
  for each row execute function public.user_reminders_set_updated_at();
