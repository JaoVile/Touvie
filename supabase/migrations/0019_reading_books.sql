-- Leitor de PDF — cada usuário sobe seus livros (PDF) e lê dentro do app.
-- O arquivo binário mora no Storage (bucket privado "books"); aqui ficam só os
-- metadados + o progresso de leitura, com RLS dono-da-linha. Espelha o padrão
-- de notes/user_reminders.
create table public.reading_books (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  title           text not null default '',
  author          text,
  file_path       text not null,                 -- caminho no Storage: "{user_id}/{id}.pdf"
  file_name       text not null default '',      -- nome original do arquivo
  file_size_bytes integer not null default 0,
  total_pages     integer,                        -- preenchido quando souber
  current_page    integer not null default 1,    -- retoma de onde parou
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.reading_books enable row level security;

create index reading_books_user_idx on public.reading_books(user_id, updated_at desc);

create policy "own select" on public.reading_books for select using (auth.uid() = user_id);
create policy "own insert" on public.reading_books for insert with check (auth.uid() = user_id);
create policy "own update" on public.reading_books for update using (auth.uid() = user_id);
create policy "own delete" on public.reading_books for delete using (auth.uid() = user_id);

create or replace function public.reading_books_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger reading_books_updated_at before update on public.reading_books
  for each row execute function public.reading_books_set_updated_at();

-- ── Storage: bucket privado "books" ──────────────────────────────────────────
-- Privado (public=false): o app serve cada PDF por URL assinada de curta duração.
insert into storage.buckets (id, name, public)
values ('books', 'books', false)
on conflict (id) do nothing;

-- Políticas no storage.objects: o usuário só mexe nos arquivos dentro da SUA
-- pasta — a 1ª pasta do caminho tem que ser o próprio uid ("{uid}/arquivo.pdf").
create policy "books own read" on storage.objects for select
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books own insert" on storage.objects for insert
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books own update" on storage.objects for update
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books own delete" on storage.objects for delete
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
