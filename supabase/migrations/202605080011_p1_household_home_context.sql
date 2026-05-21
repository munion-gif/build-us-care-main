alter table public.customers
  add column if not exists household_size integer,
  add column if not exists has_kids boolean,
  add column if not exists has_elderly boolean;

alter table public.homes
  add column if not exists floor text,
  add column if not exists complex_id text;

comment on column public.customers.household_size is '가구 인원. Stage 2 안전 자재/시공 시간 개인화용.';
comment on column public.customers.has_kids is '아동 거주 여부. Stage 2 안전 자재 추천용.';
comment on column public.customers.has_elderly is '노약자 거주 여부. Stage 2 접근성/일정 추천용.';
comment on column public.homes.floor is '층수 또는 저층/고층 정보. 엘리베이터/소음/동선 판단용.';
comment on column public.homes.complex_id is '단지명 또는 단지 식별 텍스트. 단지별 마케팅/콘텐츠 클러스터용.';
