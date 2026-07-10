-- Lembretes de UMA VEZ SÓ (one-shot) no user_reminders.
-- Aditivo e seguro: nenhuma linha existente é tocada. Os lembretes diários/
-- semanais/intervalo que já existem continuam funcionando igual.

-- 1) Passa a aceitar o tipo 'once' (além de daily/weekly/interval).
alter table public.user_reminders
  drop constraint if exists user_reminders_schedule_type_check;

alter table public.user_reminders
  add constraint user_reminders_schedule_type_check
  check (schedule_type in ('daily', 'weekly', 'interval', 'once'));

-- 2) Data do disparo único ("YYYY-MM-DD", BRT). Só usada quando schedule_type = 'once'.
alter table public.user_reminders
  add column if not exists on_date text;
