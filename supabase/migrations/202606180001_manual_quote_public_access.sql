alter table public.manual_quotes
  add column if not exists public_access_token text unique default encode(extensions.gen_random_bytes(24), 'hex');

update public.manual_quotes
set public_access_token = encode(extensions.gen_random_bytes(24), 'hex')
where public_access_token is null;

alter table public.manual_quotes
  alter column public_access_token set not null;

create index if not exists manual_quotes_public_access_token_idx
  on public.manual_quotes(public_access_token);
