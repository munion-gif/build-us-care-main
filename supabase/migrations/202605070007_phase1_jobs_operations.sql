-- Phase 1 job operation statuses and inspection timestamps.

alter type order_status add value if not exists 'issue';

alter type job_status add value if not exists 'done';
alter type job_status add value if not exists 'inspected';

alter table public.jobs
  add column if not exists inspected_at timestamptz;

alter table public.inspections
  add column if not exists inspector_note text,
  add column if not exists inspected_at timestamptz not null default now();

update public.inspections
set
  inspector_note = coalesce(inspector_note, issues_found),
  inspected_at = coalesce(inspected_at, created_at)
where inspector_note is null or inspected_at is null;
