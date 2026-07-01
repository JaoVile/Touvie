-- 0021 — Chaves do diário zero-knowledge.
--
-- Guarda a DEK (chave que cifra as anotações) "trancada" por 3 portas
-- independentes: PIN, palavra-chave e código de recuperação. Cada *_wrap é um
-- JSON { salt, iv, ct } em base64, produzido NO NAVEGADOR. O servidor nunca vê
-- a DEK em claro nem os segredos — só estes blobs. Qualquer porta destranca;
-- perder as 3 = anotações irrecuperáveis (é o preço do "nem eu leio").
--
-- A presença de uma linha aqui = "diário privado LIGADO" para o usuário.

create table if not exists public.diary_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_wrap jsonb,
  recovery_wrap jsonb,
  code_wrap jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diary_keys enable row level security;

create policy "own select" on public.diary_keys
  for select using (auth.uid() = user_id);
create policy "own insert" on public.diary_keys
  for insert with check (auth.uid() = user_id);
create policy "own update" on public.diary_keys
  for update using (auth.uid() = user_id);
create policy "own delete" on public.diary_keys
  for delete using (auth.uid() = user_id);
