alter table public.orders
  add column if not exists is_test boolean,
  add column if not exists test_marked_at timestamptz,
  add column if not exists test_marked_by text,
  add column if not exists test_note text;

update public.orders
set is_test = false
where is_test is null;

alter table public.orders
  alter column is_test set default false,
  alter column is_test set not null;

alter table public.diagnoses
  add column if not exists is_test boolean,
  add column if not exists test_marked_at timestamptz,
  add column if not exists test_marked_by text,
  add column if not exists test_note text;

update public.diagnoses
set is_test = false
where is_test is null;

alter table public.diagnoses
  alter column is_test set default false,
  alter column is_test set not null;

create index if not exists idx_orders_is_test_created_at
  on public.orders(is_test, created_at desc)
  where deleted_at is null;

create index if not exists idx_diagnoses_is_test_created_at
  on public.diagnoses(is_test, created_at desc);

comment on column public.orders.is_test is '관리자 전용 테스트 주문 여부. 고객 화면과 운영 통계에서는 제외한다.';
comment on column public.orders.test_marked_at is '관리자가 테스트 주문으로 표시하거나 해제한 시간.';
comment on column public.orders.test_marked_by is '테스트 표시를 처리한 관리자 식별자.';
comment on column public.orders.test_note is '테스트 표시 사유 또는 메모.';

comment on column public.diagnoses.is_test is '관리자 전용 테스트 사진확인 접수 여부. 운영 큐와 통계에서는 제외한다.';
comment on column public.diagnoses.test_marked_at is '관리자가 테스트 접수로 표시하거나 해제한 시간.';
comment on column public.diagnoses.test_marked_by is '테스트 표시를 처리한 관리자 식별자.';
comment on column public.diagnoses.test_note is '테스트 표시 사유 또는 메모.';
