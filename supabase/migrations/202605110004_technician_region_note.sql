alter table public.technicians
  add column if not exists region text,
  add column if not exists note text;
