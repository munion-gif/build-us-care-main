alter table public.technicians
  add column if not exists access_token text unique,
  add column if not exists last_login_at timestamptz;

update public.technicians
set access_token = encode(gen_random_bytes(16), 'hex')
where access_token is null;
