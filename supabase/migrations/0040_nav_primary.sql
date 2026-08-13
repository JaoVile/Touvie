-- 0040: barra de navegação inferior (mobile) personalizável.
--
-- Guarda QUAIS módulos ocupam os 4 lugares da barra de baixo. O resto cai
-- automaticamente no painel "Mais" — nenhum módulo fica inacessível.
-- "Mais" e "Config" não entram aqui: são fixos de propósito, senão dá pra se
-- trancar fora da própria tela de configuração.
--
-- O default são exatamente os 4 de hoje, então nada muda pra quem já usa o app
-- até a pessoa escolher outra coisa.
--
-- Idempotente: dá pra rodar de novo sem erro se uma tentativa anterior parou
-- no meio.

alter table public.profiles
  add column if not exists nav_primary text[] not null
    default array['/', '/financas', '/treino', '/dieta'];

-- Defesa no banco: exatamente 4 itens.
--
-- A UNICIDADE fica só na aplicação (`isValidPrimary` em `lib/nav-items.ts`),
-- e não aqui, porque CHECK constraint no Postgres NÃO aceita subquery — e não
-- há como contar itens distintos de um array sem `unnest`. Expressar isso no
-- banco exigiria uma função IMMUTABLE só pra isso; não vale o peso, já que
-- toda escrita passa pela Server Action que valida.
alter table public.profiles
  drop constraint if exists nav_primary_len;
alter table public.profiles
  add constraint nav_primary_len check (array_length(nav_primary, 1) = 4);
