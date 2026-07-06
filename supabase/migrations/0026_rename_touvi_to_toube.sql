-- =====================================================================
-- Assistente renomeado: Touvi → Toube. Renomeia a tabela do chat.
-- =====================================================================
-- `alter table rename` PRESERVA os dados e as policies (own select/insert/
-- delete seguem a tabela automaticamente). Renomeamos também o índice por
-- consistência. Rodar no SQL Editor do Supabase.
alter table public.touvi_messages rename to toube_messages;
alter index touvi_messages_user_idx rename to toube_messages_user_idx;
