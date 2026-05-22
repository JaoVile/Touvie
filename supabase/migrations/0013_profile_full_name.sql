-- Full name for the profile. `display_name` stays as the short
-- "apelido" rendered on the dashboard hero.
alter table public.profiles
  add column if not exists full_name text;
