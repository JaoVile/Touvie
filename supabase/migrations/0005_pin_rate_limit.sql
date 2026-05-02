alter table public.profiles
  add column if not exists pin_attempts   int          not null default 0,
  add column if not exists pin_locked_until timestamptz;
