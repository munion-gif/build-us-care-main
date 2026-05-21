select 'events_table_exists' as check,
  count(*) as value
from information_schema.tables
where table_schema = 'public'
  and table_name = 'events';

select 'utm_columns_exist' as check,
  count(*) as value
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customers'
  and column_name in ('utm_campaign','utm_source','utm_medium','referrer_url');

select 'events_by_type' as check,
  event_type,
  count(*) as count
from public.events
group by event_type
order by count desc;

select 'utm_captured_count' as check,
  count(*) as value
from public.customers
where utm_source is not null;
