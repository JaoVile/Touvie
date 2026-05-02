create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null default '',
  content     text not null default '',
  tags        text[] not null default '{}',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.notes enable row level security;

create index notes_user_idx on public.notes(user_id, updated_at desc);

create policy "own select" on public.notes for select using (auth.uid() = user_id);
create policy "own insert" on public.notes for insert with check (auth.uid() = user_id);
create policy "own update" on public.notes for update using (auth.uid() = user_id);
create policy "own delete" on public.notes for delete using (auth.uid() = user_id);

create or replace function public.notes_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger notes_updated_at before update on public.notes
  for each row execute function public.notes_set_updated_at();
