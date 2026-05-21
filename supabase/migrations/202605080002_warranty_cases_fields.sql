-- Phase 1 A/S intake fields.

alter type order_status add value if not exists 'warranty';

alter table public.warranty_cases
  add column if not exists issue_type text check (issue_type in ('leak', 'falling', 'noise', 'other')),
  add column if not exists description text,
  add column if not exists responsibility text;

comment on column public.warranty_cases.issue_type is 'A/S 신고 유형: leak/falling/noise/other';
comment on column public.warranty_cases.description is '고객이 입력한 A/S 신고 설명';
comment on column public.warranty_cases.responsibility is '책임 구분. 접수 시 null, 운영자가 판정';
