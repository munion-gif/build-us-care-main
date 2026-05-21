alter table public.diagnoses
  add column if not exists customer_name text,
  add column if not exists customer_phone text;

create index if not exists idx_diagnoses_customer_phone_created_at
  on public.diagnoses(customer_phone, created_at desc)
  where customer_phone is not null;

comment on column public.diagnoses.customer_name is '사진 판정 요청자의 이름. 관리자 주문 전환에 사용한다.';
comment on column public.diagnoses.customer_phone is '사진 판정 요청자의 연락처. 관리자 주문 전환과 고객 알림에 사용한다.';
