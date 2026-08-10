-- 0038 — Marca de conclusão da sessão de treino.
-- Aplique no SQL Editor do Supabase, depois da 0037.
--
-- POR QUE: até aqui uma sessão só nascia (startSession) e podia ser APAGADA.
-- Não havia como dizer "terminei" — o usuário logava as séries e simplesmente
-- saía da página, sem fechamento. A única ação de encerrar era destrutiva.
--
-- `completed_at` nulo = em andamento; preenchido = concluída (e o carimbo serve
-- de hora de término). Sessões antigas ficam nulas de propósito: não dá pra
-- inventar retroativamente que foram concluídas, e tratar tudo como concluído
-- estragaria a leitura do histórico.
-- =====================================================================

alter table public.workout_sessions
  add column if not exists completed_at timestamptz;

comment on column public.workout_sessions.completed_at is
  'Quando o usuário concluiu o treino. Nulo = em andamento.';

-- O histórico ordena por data e a aba Hoje busca a sessão do dia; o índice
-- parcial serve a "existe sessão aberta?" sem varrer as concluídas.
create index if not exists workout_sessions_open_idx
  on public.workout_sessions (user_id, occurred_on)
  where completed_at is null;
