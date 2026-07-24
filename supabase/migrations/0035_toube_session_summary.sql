-- Resumo rolante por sessão do Toube. Quando as mensagens cruas de uma sessão
-- passam do limiar, as mais antigas são resumidas aqui e depois podadas de
-- toube_messages (o modelo lê este resumo + a janela viva). RLS já coberta pelas
-- policies de toube_sessions (0030). Null = sessão nunca compactada.
alter table public.toube_sessions add column summary text;
