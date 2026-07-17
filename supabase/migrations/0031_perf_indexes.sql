-- 0031 — índices compostos que faltavam nas tabelas quentes de dieta/treino.
-- As demais tabelas já têm (user_id, coluna_de_data) das migrations anteriores;
-- estas eram as únicas lidas por user_id + ordenadas por data sem índice próprio.
--
-- Tabelas pessoais são pequenas → CREATE INDEX simples (lock instantâneo). Numa
-- tabela grande, prefira CREATE INDEX CONCURRENTLY (rode fora de transação, um a
-- um). Rodar no SQL Editor do Supabase, como as demais migrations.

-- Dieta: gráfico de medidas + última medida (order by measured_on desc).
create index if not exists body_measurements_user_idx
  on public.body_measurements (user_id, measured_on desc);

-- Treino: histórico de sessões (order by occurred_on desc).
create index if not exists workout_sessions_user_idx
  on public.workout_sessions (user_id, occurred_on desc);

-- Treino: carregar as séries de UMA sessão. session_id é FK e FK não é
-- auto-indexado no Postgres — sem isto, é seq scan em exercise_logs.
create index if not exists exercise_logs_session_idx
  on public.exercise_logs (session_id);

-- Treino: progressão/PR por exercício (ProgressionChart filtra por exercise_id).
create index if not exists exercise_logs_user_exercise_idx
  on public.exercise_logs (user_id, exercise_id);

-- Catálogo de exercícios do usuário (dashboard/toube listam por user_id).
create index if not exists exercises_user_idx
  on public.exercises (user_id);
