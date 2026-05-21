select
  'feedback_rows' as check_name,
  count(*) as feedback_count,
  count(*) filter (where rating is not null) as rating_count,
  count(*) filter (where nps is not null) as nps_count,
  count(*) filter (where categories <> '{}'::jsonb) as categories_count,
  count(*) filter (where submitted_at is not null) as submitted_at_count
from public.feedbacks;

select
  'latest_feedbacks' as check_name,
  order_id,
  rating,
  nps,
  comment,
  categories,
  submitted_at
from public.feedbacks
order by submitted_at desc
limit 10;

select
  'duplicate_feedback_orders' as check_name,
  order_id,
  count(*) as duplicate_count
from public.feedbacks
group by order_id
having count(*) > 1
order by duplicate_count desc;

select
  'feedback_schema_columns' as check_name,
  column_name,
  is_nullable,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'feedbacks'
  and column_name in ('rating', 'nps', 'comment', 'categories', 'submitted_at')
order by column_name;
