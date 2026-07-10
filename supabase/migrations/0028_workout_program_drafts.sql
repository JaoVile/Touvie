-- Rascunho de programa de treino montado pelo Toube Planos. O plano vive como
-- JSONB até o commit (criarProgramaCompleto), que gera as tabelas reais.
create table public.workout_program_drafts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  plan               jsonb not null default '{}'::jsonb,
  source_kind        text,                              -- 'text' | 'youtube' | 'link' | 'pdf'
  status             text not null default 'building'
                       check (status in ('building', 'committed')),
  created_program_id uuid references public.workout_programs on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.workout_program_drafts enable row level security;

create index workout_program_drafts_open_idx
  on public.workout_program_drafts(user_id, status, updated_at desc);

create policy "own select" on public.workout_program_drafts
  for select using (auth.uid() = user_id);
create policy "own insert" on public.workout_program_drafts
  for insert with check (auth.uid() = user_id);
create policy "own update" on public.workout_program_drafts
  for update using (auth.uid() = user_id);
create policy "own delete" on public.workout_program_drafts
  for delete using (auth.uid() = user_id);
