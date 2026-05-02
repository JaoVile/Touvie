alter table public.profiles
  add column if not exists locale text not null default 'pt-BR';
