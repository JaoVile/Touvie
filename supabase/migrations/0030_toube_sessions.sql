-- Sessões de conversa do Toube (estilo ChatGPT). Cada mensagem pertence a uma
-- sessão; o modelo passa a ler só a sessão atual (anti-alucinação por acúmulo).

create table public.toube_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.toube_sessions enable row level security;
create index toube_sessions_user_idx on public.toube_sessions(user_id, updated_at desc);
create policy "own select" on public.toube_sessions for select using (auth.uid() = user_id);
create policy "own insert" on public.toube_sessions for insert with check (auth.uid() = user_id);
create policy "own update" on public.toube_sessions for update using (auth.uid() = user_id);
create policy "own delete" on public.toube_sessions for delete using (auth.uid() = user_id);

-- Coluna de vínculo (nullable primeiro, pra backfill).
alter table public.toube_messages
  add column session_id uuid references public.toube_sessions(id) on delete cascade;

-- Backfill: 1 sessão por usuário com mensagens; carimba as mensagens dele nela.
insert into public.toube_sessions (user_id, title, created_at, updated_at)
select user_id, 'Conversa', min(created_at), max(created_at)
from public.toube_messages
group by user_id;

update public.toube_messages m
set session_id = s.id
from public.toube_sessions s
where s.user_id = m.user_id and m.session_id is null;

alter table public.toube_messages alter column session_id set not null;
create index toube_messages_session_idx on public.toube_messages(session_id, created_at);
