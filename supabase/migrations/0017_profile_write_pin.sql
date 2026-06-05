-- 0017 — Código de escrita do diário (separado do PIN de leitura).
--
-- O diário tem DOIS níveis: o `pin_hash` (já existente) destrava a LEITURA;
-- esta coluna nova guarda o hash de um código de 4–8 dígitos que destrava a
-- ESCRITA no dispositivo atual (seta o cookie de device confiável `rotina_edit`).
--
-- São separados de propósito: quem tem só o PIN de leitura NÃO deve conseguir
-- habilitar a escrita. Hash via bcrypt (mesmo esquema de `pin_hash`).
--
-- Nullable: perfis antigos ficam sem código até definirem um no /config.

alter table public.profiles
  add column if not exists write_pin_hash text;
