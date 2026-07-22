-- Cache de OCR por página (livros escaneados sem camada de texto). Só linhas de
-- OCR são gravadas — a camada de texto do PDF é grátis de recalcular. RLS
-- dono-da-linha, espelhando reading_highlights (0033).
create table if not exists public.reading_page_text (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  book_id    uuid not null references public.reading_books on delete cascade,
  page       integer not null,
  text       text not null default '',
  source     text not null default 'ocr' check (source in ('layer', 'ocr')),
  created_at timestamptz not null default now(),
  unique (book_id, page)
);

alter table public.reading_page_text enable row level security;

create policy "own select" on public.reading_page_text for select using (auth.uid() = user_id);
create policy "own insert" on public.reading_page_text for insert with check (auth.uid() = user_id);
create policy "own update" on public.reading_page_text for update using (auth.uid() = user_id);
create policy "own delete" on public.reading_page_text for delete using (auth.uid() = user_id);
