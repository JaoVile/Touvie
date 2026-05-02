create table public.routine_completions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  routine_id    uuid not null references public.routine_daily on delete cascade,
  completed_on  date not null default current_date
);

alter table public.routine_completions enable row level security;

create unique index routine_completions_uniq
  on public.routine_completions(user_id, routine_id, completed_on);

create index routine_completions_user_idx
  on public.routine_completions(user_id, completed_on desc);

create policy "own select" on public.routine_completions
  for select using (auth.uid() = user_id);

create policy "own insert" on public.routine_completions
  for insert with check (auth.uid() = user_id);

create policy "own delete" on public.routine_completions
  for delete using (auth.uid() = user_id);
