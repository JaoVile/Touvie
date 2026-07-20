-- Remove as colunas do GATE DE PIN LEGADO do diário (server-side, com lockout).
--
-- Contexto: o diário migrou pro modelo ZERO-KNOWLEDGE (cifra no cliente, chaves
-- em `diary_keys`, desbloqueio via `DiaryUnlockZK`/`unwrapDEK`). O gate antigo
-- server-side — rota `/api/diary/unlock` + componentes `PinGate`/`PinSetupForm` +
-- action `setupPin` — ficou ÓRFÃO da UI e foi REMOVIDO do código. Estas 3 colunas
-- só eram usadas por esse código morto e agora não têm mais nenhum leitor.
--
-- ⚠️ IRREVERSÍVEL: dropar coluna apaga os dados. Como o gate legado não é mais
-- usado, os hashes/contadores aqui são inúteis — mas confira que nenhuma linha
-- depende deles antes de rodar. NÃO mexe em `write_pin_hash` (código de escrita,
-- VIVO) nem em `recovery_hash` (palavra-chave do cadastro, VIVA).
--
-- Rodar manualmente no SQL Editor do Supabase (processo padrão do projeto).

alter table public.profiles
  drop column if exists pin_hash,
  drop column if exists pin_attempts,
  drop column if exists pin_locked_until;
