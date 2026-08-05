-- 0036 — Ciclo de treino Upper/Lower 2× (baixo volume, alta intensidade).
-- Aplique no SQL Editor do Supabase, depois do 0035.
--
-- ATENÇÃO — esta migration é DADOS, não schema. Diferente das anteriores,
-- ela não altera estrutura: popula o programa de treino de UM usuário,
-- resolvido por e-mail (jaomarfervil@gmail.com). Num banco novo, sem esse
-- usuário, ela aborta com exceção clara e não escreve nada — é segura de
-- rodar fora de ordem, só não faz sentido sem a conta existir.
--
-- Roda inteira em transação e tem guarda de reexecução: se o programa já
-- existir, aborta sem escrever.
--
-- Desenho e justificativa do ciclo:
--   docs/superpowers/specs/2026-08-05-renovacao-treino-design.md
--
-- Cria: 29 exercícios, 1 programa (ativo), 5 dias, 37 vínculos dia↔exercício.
-- Efeito colateral proposital: desativa (NÃO apaga) qualquer programa
-- anterior do usuário, incluindo o resíduo do testador E2E.
-- =====================================================================

do $$
declare
  v_email  text := 'jaomarfervil@gmail.com';
  v_user   uuid;
  v_prog   uuid;
  v_day    uuid;
  v_nome   text := 'Upper/Lower 2× — Ciclo 2026-08';
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'Nenhum usuário com e-mail %. Ajuste v_email.', v_email;
  end if;

  if exists (select 1 from public.workout_programs
             where user_id = v_user and name = v_nome) then
    raise exception 'O programa "%" já existe. Nada foi escrito.', v_nome;
  end if;

  -- ── Exercícios (29) — só cria os que faltam, por nome ──────────────
  insert into public.exercises (user_id, name, muscle_group)
  select v_user, x.nome, x.grupo
  from (values
    ('Panturrilha em pé',                    'Panturrilha'),
    ('Panturrilha sentado',                  'Panturrilha'),
    ('Supino reto com barra',                'Peito'),
    ('Supino inclinado com halteres',        'Peito'),
    ('Crossover na polia',                   'Peito'),
    ('Remada curvada',                       'Costas'),
    ('Puxada alta pronada',                  'Costas'),
    ('Barra fixa',                           'Costas'),
    ('Remada baixa na polia',                'Costas'),
    ('Elevação lateral',                     'Ombros'),
    ('Desenvolvimento com halteres',         'Ombros'),
    ('Crucifixo inverso',                    'Ombros'),
    ('Rotação externa (manguito)',           'Ombros'),
    ('Tríceps testa',                        'Tríceps'),
    ('Tríceps na corda',                     'Tríceps'),
    ('Rosca direta',                         'Bíceps'),
    ('Rosca inclinada',                      'Bíceps'),
    ('Agachamento livre',                    'Pernas'),
    ('Leg press 45°',                        'Pernas'),
    ('Cadeira extensora',                    'Pernas'),
    ('Agachamento búlgaro',                  'Pernas'),
    ('Mesa flexora',                         'Posterior'),
    ('Levantamento terra romeno',            'Posterior'),
    ('Elevação pélvica (hip thrust)',        'Glúteos'),
    ('Abdominal (elevação de pernas)',       'Abdômen'),
    ('Abdominal na polia (rosca abdominal)', 'Abdômen'),
    ('Pallof press',                         'Abdômen'),
    ('Cardio zona 2',                        'Cardio'),
    ('Mobilidade quadril + torácica',        'Corpo inteiro')
  ) as x(nome, grupo)
  where not exists (
    select 1 from public.exercises e
    where e.user_id = v_user and e.name = x.nome
  );

  -- ── Programa ───────────────────────────────────────────────────────
  insert into public.workout_programs (user_id, name, active)
  values (v_user, v_nome, true)
  returning id into v_prog;

  -- Qualquer programa anterior (inclusive o resíduo do testador E2E)
  -- sai do ar. Desativa, NÃO apaga — reversível.
  update public.workout_programs
     set active = false
   where user_id = v_user and id <> v_prog;

  -- ── Segunda · Superior A ───────────────────────────────────────────
  insert into public.workout_days (program_id, user_id, weekday, name)
  values (v_prog, v_user, 1, 'Superior A') returning id into v_day;

  insert into public.workout_day_exercises
    (user_id, program_day_id, exercise_id, sort_order, target_sets,
     target_reps_low, target_reps_high)
  select v_user, v_day, e.id, x.ord, x.sets, x.reps, x.reps
  from (values
    (1, 'Panturrilha em pé',             2::smallint, 10::smallint),
    (2, 'Supino reto com barra',         2::smallint,  5::smallint),
    (3, 'Remada curvada',                2::smallint,  6::smallint),
    (4, 'Supino inclinado com halteres', 2::smallint,  8::smallint),
    (5, 'Puxada alta pronada',           2::smallint,  8::smallint),
    (6, 'Elevação lateral',              2::smallint, 12::smallint),
    (7, 'Tríceps testa',                 2::smallint,  8::smallint),
    (8, 'Rosca direta',                  2::smallint,  8::smallint)
  ) as x(ord, nome, sets, reps)
  join public.exercises e on e.user_id = v_user and e.name = x.nome;

  -- ── Terça · Inferior A ─────────────────────────────────────────────
  insert into public.workout_days (program_id, user_id, weekday, name)
  values (v_prog, v_user, 2, 'Inferior A') returning id into v_day;

  insert into public.workout_day_exercises
    (user_id, program_day_id, exercise_id, sort_order, target_sets,
     target_reps_low, target_reps_high)
  select v_user, v_day, e.id, x.ord, x.sets, x.reps, x.reps
  from (values
    (1, 'Panturrilha em pé',               2::smallint, 10::smallint),
    (2, 'Agachamento livre',               2::smallint,  5::smallint),
    (3, 'Leg press 45°',                   2::smallint, 10::smallint),
    (4, 'Mesa flexora',                    2::smallint, 10::smallint),
    (5, 'Cadeira extensora',               2::smallint, 12::smallint),
    (6, 'Abdominal (elevação de pernas)',  2::smallint, 10::smallint)
  ) as x(ord, nome, sets, reps)
  join public.exercises e on e.user_id = v_user and e.name = x.nome;

  -- ── Quarta · Leve ──────────────────────────────────────────────────
  -- Mobilidade e cardio entram sem séries/reps: são tempo, não volume.
  insert into public.workout_days (program_id, user_id, weekday, name)
  values (v_prog, v_user, 3, 'Leve') returning id into v_day;

  insert into public.workout_day_exercises
    (user_id, program_day_id, exercise_id, sort_order, target_sets,
     target_reps_low, target_reps_high, notes)
  select v_user, v_day, e.id, x.ord, x.sets, x.reps, x.reps, x.obs
  from (values
    (1, 'Panturrilha sentado',            2::smallint,   12::smallint, null),
    (2, 'Elevação lateral',               2::smallint,   12::smallint, null),
    (3, 'Crucifixo inverso',              2::smallint,   15::smallint, null),
    (4, 'Pallof press',                   2::smallint,   10::smallint, '10 por lado'),
    (5, 'Rotação externa (manguito)',     2::smallint,   15::smallint, null),
    (6, 'Mobilidade quadril + torácica',  null::smallint, null::smallint, '5 min'),
    (7, 'Cardio zona 2',                  null::smallint, null::smallint, '20-25 min, ritmo de conversa')
  ) as x(ord, nome, sets, reps, obs)
  join public.exercises e on e.user_id = v_user and e.name = x.nome;

  -- ── Quinta · Superior B ────────────────────────────────────────────
  insert into public.workout_days (program_id, user_id, weekday, name)
  values (v_prog, v_user, 4, 'Superior B') returning id into v_day;

  insert into public.workout_day_exercises
    (user_id, program_day_id, exercise_id, sort_order, target_sets,
     target_reps_low, target_reps_high, notes)
  select v_user, v_day, e.id, x.ord, x.sets, x.reps, x.reps, x.obs
  from (values
    (1, 'Panturrilha sentado',            2::smallint, 12::smallint, null),
    (2, 'Barra fixa',                     2::smallint,  6::smallint,
        'Se não fechar 6 na 1ª série, trocar por puxada supinada na máquina'),
    (3, 'Supino inclinado com halteres',  2::smallint,  8::smallint, null),
    (4, 'Remada baixa na polia',          2::smallint,  8::smallint, null),
    (5, 'Crossover na polia',             2::smallint, 12::smallint, null),
    (6, 'Desenvolvimento com halteres',   2::smallint,  8::smallint, null),
    (7, 'Crucifixo inverso',              2::smallint, 15::smallint, null),
    (8, 'Rosca inclinada',                2::smallint, 10::smallint, null),
    (9, 'Tríceps na corda',               2::smallint, 12::smallint, null)
  ) as x(ord, nome, sets, reps, obs)
  join public.exercises e on e.user_id = v_user and e.name = x.nome;

  -- ── Sexta · Inferior B ─────────────────────────────────────────────
  insert into public.workout_days (program_id, user_id, weekday, name)
  values (v_prog, v_user, 5, 'Inferior B') returning id into v_day;

  insert into public.workout_day_exercises
    (user_id, program_day_id, exercise_id, sort_order, target_sets,
     target_reps_low, target_reps_high)
  select v_user, v_day, e.id, x.ord, x.sets, x.reps, x.reps
  from (values
    (1, 'Panturrilha em pé',                     2::smallint, 10::smallint),
    (2, 'Levantamento terra romeno',             2::smallint,  6::smallint),
    (3, 'Agachamento búlgaro',                   2::smallint,  8::smallint),
    (4, 'Mesa flexora',                          2::smallint, 10::smallint),
    (5, 'Elevação pélvica (hip thrust)',         2::smallint,  8::smallint),
    (6, 'Cadeira extensora',                     2::smallint, 12::smallint),
    (7, 'Abdominal na polia (rosca abdominal)',  2::smallint, 10::smallint)
  ) as x(ord, nome, sets, reps)
  join public.exercises e on e.user_id = v_user and e.name = x.nome;

  raise notice 'OK — programa % criado.', v_nome;
end $$;
