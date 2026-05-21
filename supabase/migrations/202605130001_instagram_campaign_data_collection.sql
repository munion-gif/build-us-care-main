-- Instagram campaign data collection for Excel exports.

alter table public.events
  add column if not exists source text,
  add column if not exists campaign text,
  add column if not exists landing_path text,
  add column if not exists device_type text,
  add column if not exists service_code text,
  add column if not exists region_code text,
  add column if not exists meta_note text;

update public.events
set
  source = coalesce(source, properties->>'source', properties->>'utm_source', properties->>'traffic_source'),
  campaign = coalesce(campaign, properties->>'campaign', properties->>'utm_campaign'),
  landing_path = coalesce(landing_path, properties->>'landing_path', properties->>'page_path'),
  device_type = coalesce(device_type, properties->>'device_type'),
  service_code = coalesce(service_code, properties->>'service_code', properties->>'service_type_code'),
  region_code = coalesce(region_code, properties->>'region_code', properties->>'region'),
  meta_note = coalesce(meta_note, properties->>'meta_note')
where source is null
   or campaign is null
   or landing_path is null
   or device_type is null
   or service_code is null
   or region_code is null
   or meta_note is null;

update public.events
set event_type = case event_type
  when 'instagram_landing_view' then 'landing_view'
  when 'quote_started' then 'quote_start'
  when 'quote_submitted' then 'quote_submit'
  when 'payment_completed' then 'payment_done'
  when 'order_lookup_from_instagram' then 'order_lookup'
  when 'status_page_view' then 'status_view'
  else event_type
end;

create index if not exists idx_events_source_campaign on public.events(source, campaign);
create index if not exists idx_events_export_time on public.events(occurred_at desc, source, campaign);
create index if not exists idx_events_event_funnel on public.events(event_type, source, campaign);

create table if not exists public.sessions (
  session_id text primary key,
  first_event_time timestamptz not null default now(),
  source text not null default 'direct',
  campaign text,
  landing_path text,
  device_type text,
  region_hint text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sessions_source_campaign on public.sessions(source, campaign);
create index if not exists idx_sessions_first_event_time on public.sessions(first_event_time desc);
create index if not exists idx_sessions_order_id on public.sessions(order_id);

alter table public.sessions enable row level security;
alter table public.sessions force row level security;

drop policy if exists "service role full access" on public.sessions;
create policy "service role full access" on public.sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

alter table public.orders
  add column if not exists source text,
  add column if not exists campaign text,
  add column if not exists session_id text,
  add column if not exists landing_path text,
  add column if not exists device_type text,
  add column if not exists region_code text,
  add column if not exists soft_launch_flag boolean not null default false,
  add column if not exists quality_flag text;

update public.orders o
set
  source = coalesce(o.source, c.utm_source, o.channel),
  campaign = coalesce(o.campaign, c.utm_campaign),
  region_code = coalesce(o.region_code, (select h.address_dong from public.homes h where h.id = o.home_id limit 1))
from public.customers c
where c.id = o.customer_id
  and (o.source is null or o.campaign is null or o.region_code is null);

create index if not exists idx_orders_source_campaign on public.orders(source, campaign);
create index if not exists idx_orders_session_id on public.orders(session_id);
create index if not exists idx_orders_campaign_created_at on public.orders(campaign, created_at desc);

create table if not exists public.dim_channels (
  code text primary key,
  name text not null,
  description text
);

create table if not exists public.dim_campaigns (
  code text primary key,
  name text not null,
  description text
);

create table if not exists public.dim_services (
  code text primary key,
  name text not null,
  description text
);

create table if not exists public.dim_regions (
  code text primary key,
  name text not null,
  description text
);

insert into public.dim_channels(code, name, description) values
  ('instagram', 'Instagram', 'Instagram paid/social traffic'),
  ('kakao', 'Kakao', 'Kakao channel traffic'),
  ('web', 'Web', 'General web traffic'),
  ('direct', 'Direct', 'Direct or no-referrer traffic'),
  ('organic', 'Organic', 'Organic search or unpaid discovery'),
  ('offline', 'Offline', 'Offline/manual source')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.dim_campaigns(code, name, description) values
  ('suwon_toilet_fixed_price', '수원 변기 교체 정찰가 캠페인', 'First Instagram campaign for fixed-price toilet replacement in Suwon')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.dim_regions(code, name, description) values
  ('suwon_yeongtong', '수원 영통', 'Suwon Yeongtong area'),
  ('suwon_gwanggyo', '수원 광교', 'Suwon Gwanggyo area'),
  ('suwon', '수원', 'Suwon city fallback')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.dim_services(code, name, description)
select service_type_code, display_name, coalesce(photo_guide, category)
from public.service_items
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

create or replace view public.analytics_events_export
with (security_invoker = true)
as
select
  e.id as event_id,
  e.occurred_at as event_time,
  e.session_id,
  e.order_id,
  e.event_type,
  coalesce(e.source, e.properties->>'source', e.properties->>'utm_source', e.properties->>'traffic_source', 'direct') as source,
  coalesce(e.campaign, e.properties->>'campaign', e.properties->>'utm_campaign') as campaign,
  coalesce(e.landing_path, e.properties->>'landing_path', e.properties->>'page_path') as landing_path,
  coalesce(e.device_type, e.properties->>'device_type') as device_type,
  coalesce(e.service_code, e.properties->>'service_code', e.properties->>'service_type_code') as service_code,
  coalesce(e.region_code, e.properties->>'region_code', e.properties->>'region') as region_code,
  coalesce(e.meta_note, e.properties->>'meta_note') as meta_note
from public.events e;

create or replace view public.analytics_sessions_export
with (security_invoker = true)
as
select
  session_id,
  first_event_time,
  source,
  campaign,
  landing_path,
  device_type,
  region_hint,
  order_id
from public.sessions;

create or replace view public.analytics_orders_export
with (security_invoker = true)
as
select
  o.id as order_id,
  o.created_at,
  coalesce(o.service_type_code, o.skus->0->>'service_type_code', o.skus->0->>'sku') as service_code,
  coalesce(o.region_code, h.address_dong, 'unknown') as region_code,
  coalesce(o.source, c.utm_source, o.channel, 'web') as source,
  coalesce(o.campaign, c.utm_campaign) as campaign,
  case when o.soft_launch_flag then 1 else 0 end as soft_launch_flag,
  coalesce(p.amount, q.total_final, o.total_amount) as amount_final,
  o.status::text as status_final,
  case
    when c.first_contact_at is null or c.first_contact_at < o.created_at then null
    else floor(extract(epoch from (c.first_contact_at - o.created_at)) / 60)::integer
  end as lead_time_first_contact_min,
  case
    when j.completed_at is null then null
    else floor(extract(epoch from (j.completed_at - o.created_at)) / 60)::integer
  end as lead_time_done_min,
  coalesce(o.quality_flag, case
    when o.status::text in ('canceled', 'cancelled', 'cancel_requested') then '고객취소'
    when o.status::text in ('issue', 'warranty') then '미스매치'
    else 'ok'
  end) as quality_flag,
  case when wc.id is null then 0 else 1 end as warranty_flag,
  coalesce(f.rating::numeric, f.score_quality::numeric, f.nps::numeric / 2.0) as feedback_score_overall
from public.orders o
left join public.customers c on c.id = o.customer_id
left join public.homes h on h.id = o.home_id
left join lateral (
  select amount
  from public.payments
  where order_id = o.id and status = 'done'
  order by paid_at desc nulls last, approved_at desc nulls last, created_at desc
  limit 1
) p on true
left join lateral (
  select total_final
  from public.quotes
  where order_id = o.id
  order by accepted_at desc nulls last, version desc
  limit 1
) q on true
left join lateral (
  select completed_at
  from public.jobs
  where order_id = o.id
  order by completed_at desc nulls last, created_at desc
  limit 1
) j on true
left join lateral (
  select id
  from public.warranty_cases
  where order_id = o.id
  order by created_at desc
  limit 1
) wc on true
left join public.feedbacks f on f.order_id = o.id;
