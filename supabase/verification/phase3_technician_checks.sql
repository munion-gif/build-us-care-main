select 'technician_token_count' as check,
  count(*) filter (where access_token is not null) as value
from public.technicians;

select 'job_with_started_at' as check, count(*) as value
from public.jobs
where started_at is not null;

select 'job_with_actual_minutes' as check, count(*) as value
from public.jobs
where actual_minutes is not null;

select 'tech_media_count' as check, count(*) as value
from public.media
where job_id is not null;
