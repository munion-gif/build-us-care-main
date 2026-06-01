alter table public.orders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deleted_reason text;

create index if not exists idx_orders_active_created_at
  on public.orders(created_at desc)
  where deleted_at is null;

create index if not exists idx_orders_deleted_at
  on public.orders(deleted_at desc)
  where deleted_at is not null;

comment on column public.orders.deleted_at is '관리자가 주문을 휴지통으로 이동한 시간. null이면 활성 주문이다.';
comment on column public.orders.deleted_by is '주문을 휴지통으로 이동한 관리자 식별자.';
comment on column public.orders.deleted_reason is '주문을 휴지통으로 이동한 사유 또는 메모.';
