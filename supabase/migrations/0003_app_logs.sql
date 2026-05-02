create table if not exists app_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  event_type      text not null check (event_type in ('cron', 'webhook', 'api', 'system')),
  source          text not null,
  status          text not null default 'success' check (status in ('success', 'error', 'warning')),
  message_preview varchar(40),
  metadata        jsonb
);

alter table app_logs enable row level security;

create policy "users_see_own_logs" on app_logs
  for select using (auth.uid() = user_id);

-- service role bypasses RLS; anon/authenticated still need explicit insert policy
create policy "service_can_insert" on app_logs
  for insert with check (true);

create index if not exists app_logs_user_created_idx on app_logs (user_id, created_at desc);
