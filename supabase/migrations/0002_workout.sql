-- 0002 — Workout: junction table day↔exercises e view de PRs.
-- Aplique este SQL no SQL Editor do Supabase depois do 0001.

-- =====================================================================
-- workout_day_exercises (template: exercícios planejados por dia)
-- =====================================================================
create table if not exists public.workout_day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_day_id uuid not null references public.workout_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order integer not null default 0,
  target_sets smallint,
  target_reps_low smallint,
  target_reps_high smallint,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists wde_user_idx on public.workout_day_exercises(user_id);
create index if not exists wde_day_idx on public.workout_day_exercises(program_day_id, sort_order);

alter table public.workout_day_exercises enable row level security;

create policy "own select" on public.workout_day_exercises
  for select using (auth.uid() = user_id);
create policy "own insert" on public.workout_day_exercises
  for insert with check (auth.uid() = user_id);
create policy "own update" on public.workout_day_exercises
  for update using (auth.uid() = user_id);
create policy "own delete" on public.workout_day_exercises
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- personal_records — view com melhor 1RM estimado (Epley) por exercício.
-- 1RM ≈ weight * (1 + reps/30). Considera apenas séries com peso e reps válidos.
-- =====================================================================
create or replace view public.personal_records as
select
  l.user_id,
  l.exercise_id,
  e.name as exercise_name,
  e.muscle_group,
  max(l.weight_kg * (1 + (l.reps::numeric / 30))) as best_1rm,
  max(l.weight_kg) as best_weight,
  count(*) as total_sets,
  max(s.occurred_on) as last_logged_on
from public.exercise_logs l
join public.exercises e on e.id = l.exercise_id
join public.workout_sessions s on s.id = l.session_id
where l.weight_kg is not null and l.reps is not null and l.reps > 0
group by l.user_id, l.exercise_id, e.name, e.muscle_group;

-- A view herda RLS das tabelas-fonte (exercise_logs / exercises) que já filtram por user_id.
