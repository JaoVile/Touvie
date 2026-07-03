-- =====================================================================
-- Touvi — assistente de IA (chat). Histórico de mensagens (append-only).
-- =====================================================================
-- Uma linha por turno (user OU assistant). Cada usuário só vê/insere as suas
-- (RLS own-row, espelha user_reminders). A resposta do assistente é gravada
-- com o MESMO user_id (é a conversa do dono), então passa pela mesma policy
-- de insert — sem precisar de service_role.
--
-- Rodar no SQL Editor do Supabase.
create table public.touvi_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.touvi_messages enable row level security;

create index touvi_messages_user_idx on public.touvi_messages(user_id, created_at);

create policy "own select" on public.touvi_messages for select using (auth.uid() = user_id);
create policy "own insert" on public.touvi_messages for insert with check (auth.uid() = user_id);
create policy "own delete" on public.touvi_messages for delete using (auth.uid() = user_id);
