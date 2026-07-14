-- No máximo UM rascunho "building" por usuário. A corrida do getOrCreateDraft
-- (select-then-insert sem lock) podia criar dois; este índice único parcial é o
-- cinto-e-suspensório. Primeiro remove duplicatas existentes (mantém o mais
-- recente por usuário), senão a criação do índice falha.

-- 1) Apaga rascunhos building duplicados, preservando o mais recente por usuário.
delete from public.workout_program_drafts d
where d.status = 'building'
  and exists (
    select 1
    from public.workout_program_drafts d2
    where d2.user_id = d.user_id
      and d2.status = 'building'
      and (d2.updated_at > d.updated_at or (d2.updated_at = d.updated_at and d2.id > d.id))
  );

-- 2) Índice único parcial: garante 1 building por usuário daqui pra frente.
create unique index if not exists workout_program_drafts_one_building
  on public.workout_program_drafts (user_id)
  where status = 'building';
