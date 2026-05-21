select to_regclass('public.events') as events_table,
       to_regclass('public.sessions') as sessions_table,
       to_regclass('public.analytics_events_export') as events_export_view,
       to_regclass('public.analytics_orders_export') as orders_export_view,
       to_regclass('public.analytics_sessions_export') as sessions_export_view;

select code, name
from public.dim_channels
where code in ('instagram', 'web', 'direct')
order by code;

select code, name
from public.dim_campaigns
where code = 'suwon_toilet_fixed_price';

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'events'
  and column_name in ('source', 'campaign', 'landing_path', 'device_type', 'service_code', 'region_code', 'meta_note')
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name in ('source', 'campaign', 'session_id', 'landing_path', 'device_type', 'region_code', 'soft_launch_flag', 'quality_flag')
order by column_name;
