-- Tighten Phase 1 media ownership: exactly one owner is required.

alter table public.media
  drop constraint if exists media_owner_check;

alter table public.media
  add constraint media_owner_check check (
    (order_id is not null and job_id is null)
    or
    (order_id is null and job_id is not null)
  );
