-- =====================================================================
-- personal_records: aplica security_invoker (correção de vazamento cross-user)
-- =====================================================================
-- A view foi criada em 0002 SEM `security_invoker`, então executava com os
-- privilégios do dono (role postgres, BYPASSRLS) e NÃO aplicava a RLS de
-- exercise_logs/exercises — qualquer usuário autenticado conseguia ler os PRs
-- (cargas, 1RM, grupo muscular) de todos os outros. O comentário original
-- ("herda RLS das tabelas-fonte") só é verdade com security_invoker=on, que já
-- fora aplicado à finance_account_balances (0014/0016) mas esquecido aqui.
--
-- Corpo idêntico ao de 0002 — muda apenas o `with (security_invoker = on)`.
create or replace view public.personal_records
with (security_invoker = on) as
select
  l.user_id,
  l.exercise_id,
  e.name as exercise_name,
  e.muscle_group,
  max(l.weight_kg * (1 + (l.reps::numeric / 30))) as best_1rm,
  max(l.weight_kg) as best_weight,
  count(*) as total_sets,
  max(s.occurred_on) as last_logged_on
from public.exercise_logs l
join public.exercises e on e.id = l.exercise_id
join public.workout_sessions s on s.id = l.session_id
where l.weight_kg is not null and l.reps is not null and l.reps > 0
group by l.user_id, l.exercise_id, e.name, e.muscle_group;
