-- Leitor de PDF rico: liga o progresso (colunas de 0019), adiciona capa e
-- highlights ancorados (retângulos normalizados 0–1 por página). RLS dono-da-linha,
-- espelhando reading_books (0019).

-- (a) reading_books: capa, última leitura, e o gerenciador (status manual + favorito).
alter table public.reading_books
  add column if not exists cover_path   text,          -- "{uid}/{uuid}.cover.webp" no bucket books
  add column if not exists last_read_at timestamptz,
  add column if not exists status       text not null default 'unread'
    check (status in ('unread', 'reading', 'read')),  -- status MANUAL (o usuário marca)
  add column if not exists is_favorite  boolean not null default false;
-- current_page / total_pages já existem (0019) — agora escritas de fato (resume, não status).

create index if not exists reading_books_status_idx on public.reading_books(user_id, status);

-- (b) highlights ancorados na camada de texto.
create table if not exists public.reading_highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  book_id     uuid not null references public.reading_books on delete cascade,
  page        integer not null,
  rects       jsonb   not null,             -- [{"x":..,"y":..,"w":..,"h":..}] normalizados 0–1
  text        text    not null default '',  -- trecho selecionado (fallback/busca)
  color       text    not null default 'yellow',
  note        text,                          -- anotação opcional
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.reading_highlights enable row level security;

create index if not exists reading_highlights_book_idx
  on public.reading_highlights(book_id, page);

create policy "own select" on public.reading_highlights for select using (auth.uid() = user_id);
create policy "own insert" on public.reading_highlights for insert with check (auth.uid() = user_id);
create policy "own update" on public.reading_highlights for update using (auth.uid() = user_id);
create policy "own delete" on public.reading_highlights for delete using (auth.uid() = user_id);

create trigger reading_highlights_updated_at before update on public.reading_highlights
  for each row execute function public.reading_books_set_updated_at();
