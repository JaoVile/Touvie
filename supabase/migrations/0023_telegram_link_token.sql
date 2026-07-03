-- =====================================================================
-- Telegram: token de vínculo de uso único (correção de sequestro de conta)
-- =====================================================================
-- ANTES: o /start do bot vinculava o chat de QUEM MANDASSE a mensagem ao
-- primeiro perfil criado, sem verificar identidade. Qualquer estranho que
-- achasse o bot mandava /start e assumia a conta (lia saldo, injetava
-- transações, roubava os lembretes com dados pessoais).
--
-- AGORA: a tela autenticada (Config → Telegram) gera um token de uso único,
-- com validade curta, embutido no deep link `t.me/<bot>?start=<token>`. O
-- webhook só vincula o chat ao dono do token — e queima o token no uso.
--
-- Rodar no SQL Editor do Supabase ANTES de fazer deploy do código novo.
alter table public.profiles
  add column if not exists telegram_link_token text,
  add column if not exists telegram_link_expires_at timestamptz;

-- Busca por token no /start (parcial: só linhas com token pendente).
create index if not exists profiles_telegram_link_token_idx
  on public.profiles (telegram_link_token)
  where telegram_link_token is not null;
