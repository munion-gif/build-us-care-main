-- Phase 1 P0 feedback scoring columns.
-- Idempotent because older environments may already have these columns from the foundation migration.

alter table public.feedbacks
  add column if not exists score_time smallint check (score_time between 1 and 5),
  add column if not exists score_quality smallint check (score_quality between 1 and 5),
  add column if not exists score_response smallint check (score_response between 1 and 5),
  add column if not exists score_clean smallint check (score_clean between 1 and 5),
  add column if not exists score_price smallint check (score_price between 1 and 5),
  add column if not exists would_recommend boolean default null,
  add column if not exists would_repurchase boolean default null;

update public.feedbacks
set
  score_time = coalesce(score_time, nullif(categories->>'speed', '')::smallint),
  score_quality = coalesce(score_quality, nullif(categories->>'quality', '')::smallint),
  score_response = coalesce(score_response, nullif(categories->>'kindness', '')::smallint),
  score_clean = coalesce(score_clean, nullif(categories->>'cleanliness', '')::smallint),
  score_price = coalesce(score_price, nullif(categories->>'price', '')::smallint)
where categories is not null;

comment on column public.feedbacks.score_time is '시간 만족도 1-5';
comment on column public.feedbacks.score_quality is '품질 만족도 1-5';
comment on column public.feedbacks.score_response is '응대 만족도 1-5';
comment on column public.feedbacks.score_clean is '청결 만족도 1-5';
comment on column public.feedbacks.score_price is '가격 만족도 1-5';
comment on column public.feedbacks.would_recommend is '추천 의사';
comment on column public.feedbacks.would_repurchase is '재의뢰 의사';
