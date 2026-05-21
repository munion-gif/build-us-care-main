insert into service_items (service_type_code, display_name, base_price, estimated_minutes, metadata) values
  ('bathroom_basic', '욕실 기본 점검/소모품 교체', 60000, 60, '{"category":"bathroom"}'),
  ('kitchen_faucet', '주방 수전 교체', 90000, 90, '{"category":"kitchen"}'),
  ('light_replace', '조명 교체', 40000, 40, '{"category":"lighting"}'),
  ('door_handle', '도어 핸들 교체', 35000, 30, '{"category":"door"}'),
  ('toilet_replace', '변기 교체', 80000, 120, '{"category":"bathroom"}'),
  ('bath_fan', '욕실 환풍기 교체', 70000, 80, '{"category":"bathroom"}'),
  ('slide_bar', '샤워 슬라이드바 교체', 45000, 45, '{"category":"bathroom"}'),
  ('drain_replace', '욕실 유가 교체', 50000, 50, '{"category":"bathroom"}')
on conflict (service_type_code) do update set
  display_name = excluded.display_name,
  base_price = excluded.base_price,
  estimated_minutes = excluded.estimated_minutes,
  metadata = excluded.metadata;

insert into products (sku, name, category, grade, material_cost, install_cost, estimated_minutes, as_months, is_active) values
  ('TEMP-TOILET-BASIC', '임시 변기 교체 일반형', 'bathroom', 'basic', 120000, 80000, 120, 12, true),
  ('TEMP-FAUCET-BASIC', '임시 수전 교체 일반형', 'kitchen', 'basic', 50000, 90000, 90, 12, true)
on conflict (sku) do nothing;

insert into product_options (product_id, name, price_delta, is_active)
select id, '앵글밸브 추가', 15000, true from products where sku = 'TEMP-TOILET-BASIC'
on conflict do nothing;

insert into customers (phone, name) values
  ('01012345678', '테스트 고객 A'),
  ('01098765432', '테스트 고객 B')
on conflict (phone) do update set name = excluded.name;

with c as (
  select id, phone from customers where phone in ('01012345678', '01098765432')
),
o as (
  insert into orders (
    order_number,
    customer_id,
    status,
    service_type_code,
    visit_fee,
    subtotal_amount,
    total_amount,
    special_requests
  )
  select
    case when phone = '01012345678' then 'BO-20260506-0001' else 'BO-20260506-0002' end,
    id,
    case when phone = '01012345678' then 'reservation_confirmed'::order_status else 'paid'::order_status end,
    case when phone = '01012345678' then 'toilet_replace' else 'kitchen_faucet' end,
    15000,
    case when phone = '01012345678' then 95000 else 105000 end,
    case when phone = '01012345678' then 110000 else 120000 end,
    case when phone = '01012345678' then '엘리베이터 있음' else '오전 선호' end
  from c
  on conflict (order_number) do nothing
  returning id, order_number, customer_id
)
insert into addresses (order_id, customer_id, road_address, detail_address, postal_code)
select id, customer_id, '경기 수원시 팔달구 테스트로 1', '101동 1001호', '16490'
from o;

insert into order_items (order_id, item_name, option_summary, qty, unit_price, line_total, metadata)
select id, '변기 교체', '앵글밸브 추가', 1, 95000, 95000, '{"service_type_code":"toilet_replace"}'
from orders where order_number = 'BO-20260506-0001'
on conflict do nothing;

insert into order_items (order_id, item_name, option_summary, qty, unit_price, line_total, metadata)
select id, '주방 수전 교체', null, 1, 105000, 105000, '{"service_type_code":"kitchen_faucet"}'
from orders where order_number = 'BO-20260506-0002'
on conflict do nothing;

insert into reservations (order_id, reserved_date, time_slot, status, notes)
select id, date '2026-05-09', 'all_day', 'confirmed', 'seed 예약'
from orders where order_number = 'BO-20260506-0001'
on conflict do nothing;

insert into payments (order_id, provider, payment_key, order_name, amount, status, requested_at, approved_at)
select id, 'toss', 'mock-payment-key-seed', '주방 수전 교체', 120000, 'done', now(), now()
from orders where order_number = 'BO-20260506-0002'
on conflict do nothing;

insert into jobs (order_id, assigned_technician_name, status, scheduled_date)
select id, '김시공', 'scheduled', date '2026-05-09'
from orders where order_number = 'BO-20260506-0001'
on conflict (order_id) do nothing;

insert into jobs (order_id, assigned_technician_name, status, scheduled_date)
select id, '이시공', 'assigned', date '2026-05-10'
from orders where order_number = 'BO-20260506-0002'
on conflict (order_id) do nothing;

insert into job_status_logs (job_id, from_status, to_status, memo)
select id, null, status, 'seed 초기 로그'
from jobs
where not exists (
  select 1 from job_status_logs where job_status_logs.job_id = jobs.id
);
