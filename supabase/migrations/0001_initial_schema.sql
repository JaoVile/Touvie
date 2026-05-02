-- Rotina Life OS - Initial schema
-- Single-tenant design, RLS-ready for future multi-user.

create extension if not exists "pgcrypto";

-- =====================================================================
-- PROFILES (one row per auth user)
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  telegram_chat_id text,
  pin_hash text,
  pin_salt text,
  theme text not null default 'glass-purple',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- JOURNAL (manifestation / scripting, PIN-gated)
-- =====================================================================
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create index if not exists journal_entries_user_week_idx
  on public.journal_entries(user_id, week_start desc);

-- =====================================================================
-- ROUTINES (daily + weekly)
-- =====================================================================
create table if not exists public.routine_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  time_slot time not null,
  title text not null,
  emoji text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routine_daily_user_idx on public.routine_daily(user_id, time_slot);

create table if not exists public.routine_weekly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  block text not null,
  title text not null,
  emoji text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routine_weekly_user_idx on public.routine_weekly(user_id, weekday);

-- =====================================================================
-- GOALS + TASKS
-- =====================================================================
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_goal_id uuid references public.goals(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status text not null default 'active' check (status in ('active', 'done', 'paused', 'dropped')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals(user_id, status, sort_order);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks(user_id, done, due_date);

-- =====================================================================
-- FINANCE
-- =====================================================================
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('cash', 'checking', 'savings', 'credit', 'investment')),
  balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  emoji text,
  color text,
  archived boolean not null default false
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.finance_accounts(id) on delete set null,
  category_id uuid references public.finance_categories(id) on delete set null,
  amount_cents bigint not null,
  kind text not null check (kind in ('income', 'expense')),
  occurred_on date not null,
  description text,
  is_recurring boolean not null default false,
  recurrence_rule text,
  reminder_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx
  on public.transactions(user_id, occurred_on desc);

-- =====================================================================
-- WORKOUT
-- =====================================================================
create table if not exists public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  name text not null
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text,
  notes text
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_day_id uuid references public.workout_days(id) on delete set null,
  occurred_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number smallint not null,
  reps smallint,
  weight_kg numeric(6, 2),
  rpe smallint
);

-- =====================================================================
-- DIET
-- =====================================================================
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kcal_per_100g numeric(7, 2) not null,
  protein_g numeric(6, 2) not null default 0,
  carb_g numeric(6, 2) not null default 0,
  fat_g numeric(6, 2) not null default 0,
  fiber_g numeric(6, 2) not null default 0,
  serving_g numeric(7, 2)
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snack', 'dinner', 'pre', 'post', 'other')),
  notes text
);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete restrict,
  grams numeric(7, 2) not null
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5, 2),
  waist_cm numeric(5, 2),
  chest_cm numeric(5, 2),
  arm_cm numeric(5, 2),
  thigh_cm numeric(5, 2),
  bodyfat_pct numeric(5, 2),
  notes text
);

-- =====================================================================
-- AUTO-CREATE PROFILE on signup
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- RLS POLICIES (single-tenant, each user sees only own rows)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.journal_entries enable row level security;
alter table public.routine_daily enable row level security;
alter table public.routine_weekly enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.transactions enable row level security;
alter table public.workout_programs enable row level security;
alter table public.workout_days enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.foods enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.body_measurements enable row level security;

-- Profiles: owner via id column
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

-- Generic per-table policies via user_id
do $$
declare
  t text;
  tables text[] := array[
    'journal_entries','routine_daily','routine_weekly','goals','tasks',
    'finance_accounts','finance_categories','transactions',
    'workout_programs','workout_days','exercises','workout_sessions','exercise_logs',
    'foods','meals','meal_items','body_measurements'
  ];
begin
  foreach t in array tables loop
    execute format('create policy "own select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own update" on public.%I for update using (auth.uid() = user_id)', t);
    execute format('create policy "own delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- =====================================================================
-- SEED: default finance categories (PT-BR)
-- Applied per-user by a server action after first login, not here.
-- =====================================================================
