-- Store the visit schedule selected while creating an administrator manual quote.

alter table public.manual_quotes
  add column if not exists reserved_date date,
  add column if not exists time_slot text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manual_quotes_time_slot_check'
      and conrelid = 'public.manual_quotes'::regclass
  ) then
    alter table public.manual_quotes
      add constraint manual_quotes_time_slot_check
      check (time_slot is null or time_slot in ('morning', 'afternoon'));
  end if;
end $$;

create index if not exists manual_quotes_reserved_date_idx on public.manual_quotes(reserved_date);
