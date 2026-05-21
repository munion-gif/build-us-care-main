select
  'job_rows' as check_name,
  count(*) as job_count,
  count(*) filter (where status = 'scheduled') as scheduled_count,
  count(*) filter (where status = 'in_progress') as in_progress_count,
  count(*) filter (where status = 'done') as done_count,
  count(*) filter (where status = 'inspected') as inspected_count,
  count(*) filter (where started_at is not null) as started_at_count,
  count(*) filter (where completed_at is not null) as completed_at_count,
  count(*) filter (where inspected_at is not null) as inspected_at_count
from public.jobs;

select
  'latest_jobs' as check_name,
  id,
  order_id,
  technician_id,
  status,
  scheduled_at,
  started_at,
  completed_at,
  inspected_at,
  created_at
from public.jobs
order by created_at desc
limit 10;

select
  'latest_inspections' as check_name,
  job_id,
  passed,
  inspector_note,
  inspected_at,
  created_at
from public.inspections
order by created_at desc
limit 10;

select
  'latest_job_status_logs' as check_name,
  job_id,
  from_status,
  to_status,
  memo,
  created_at
from public.job_status_logs
order by created_at desc
limit 20;

select
  'job_status_enum_values' as check_name,
  enumlabel as status
from pg_enum
where enumtypid = 'public.job_status'::regtype
  and enumlabel in ('done', 'inspected')
order by enumlabel;

select
  'order_status_enum_values' as check_name,
  enumlabel as status
from pg_enum
where enumtypid = 'public.order_status'::regtype
  and enumlabel in ('scheduled', 'in_progress', 'done', 'issue')
order by enumlabel;
