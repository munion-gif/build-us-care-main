select
  'media_rows_by_owner' as check_name,
  count(*) filter (where order_id is not null and job_id is null) as order_media_count,
  count(*) filter (where order_id is null and job_id is not null) as job_media_count,
  count(*) filter (where order_id is not null and job_id is not null) as invalid_both_owner_count,
  count(*) filter (where order_id is null and job_id is null) as invalid_missing_owner_count
from public.media;

select
  'latest_order_inquiry_media' as check_name,
  order_id,
  type,
  sort_order,
  file_path,
  created_at
from public.media
where order_id is not null
order by created_at desc
limit 10;

select
  'latest_job_media' as check_name,
  job_id,
  type,
  sort_order,
  file_path,
  created_at
from public.media
where job_id is not null
order by created_at desc
limit 10;

select
  'media_owner_constraint' as check_name,
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.media'::regclass
  and conname = 'media_owner_check';

select
  'media_sort_order_duplicates' as check_name,
  owner_type,
  owner_id,
  sort_order,
  count(*) as duplicate_count
from (
  select 'order' as owner_type, order_id::text as owner_id, sort_order
  from public.media
  where order_id is not null
  union all
  select 'job' as owner_type, job_id::text as owner_id, sort_order
  from public.media
  where job_id is not null
) grouped_media
group by owner_type, owner_id, sort_order
having count(*) > 1
order by duplicate_count desc;
