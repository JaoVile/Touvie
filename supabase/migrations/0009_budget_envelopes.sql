create table public.budget_envelopes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  category_id   uuid references public.finance_categories on delete cascade,
  month         varchar(7) not null,
  limit_cents   bigint not null,
  name          text not null,
  emoji         text,
  color         text,
  created_at    timestamptz not null default now()
);

alter table public.budget_envelopes enable row level security;

create unique index budget_envelopes_uniq on public.budget_envelopes(user_id, category_id, month);

create policy "own select" on public.budget_envelopes for select using (auth.uid() = user_id);
create policy "own insert" on public.budget_envelopes for insert with check (auth.uid() = user_id);
create policy "own update" on public.budget_envelopes for update using (auth.uid() = user_id);
create policy "own delete" on public.budget_envelopes for delete using (auth.uid() = user_id);
