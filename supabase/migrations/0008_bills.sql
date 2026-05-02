create table public.bills (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  title           text not null,
  amount_cents    bigint not null,
  due_date        date not null,
  paid_at         timestamptz,
  recurrence_rule text,
  category_id     uuid references public.finance_categories on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

alter table public.bills enable row level security;

create index bills_user_due_idx on public.bills(user_id, due_date);

create policy "own select" on public.bills for select using (auth.uid() = user_id);
create policy "own insert" on public.bills for insert with check (auth.uid() = user_id);
create policy "own update" on public.bills for update using (auth.uid() = user_id);
create policy "own delete" on public.bills for delete using (auth.uid() = user_id);
