-- 0020 — Palavra-chave de recuperação (definida no cadastro).
--
-- Guarda o hash bcrypt de uma "palavra-chave" que o usuário escolhe ao se
-- cadastrar. Serve pra REDEFINIR o PIN do diário caso ele esqueça (o único
-- caminho de recuperação, já que ninguém — nem o dono do sistema — tem acesso
-- à conta de ninguém). No diário zero-knowledge (modelo B) esta palavra-chave
-- também é a 2ª chave de recuperação do conteúdo cifrado.
--
-- Hash via bcrypt (mesmo esquema de `pin_hash` / `write_pin_hash`).
-- Nullable: perfis antigos ficam sem palavra-chave até definirem uma.

alter table public.profiles
  add column if not exists recovery_hash text;
