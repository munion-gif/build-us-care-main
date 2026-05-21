-- Phase 1 data backfill.
-- Converts MVP attachment/review tables into the new media/feedbacks shape
-- without deleting legacy rows.

insert into public.media (order_id, type, url, file_path, sort_order, created_at)
select order_id, 'inquiry'::media_type, file_path, file_path, sort_order, created_at
from public.order_photos
where not exists (
  select 1 from public.media
  where media.order_id = order_photos.order_id
    and media.file_path = order_photos.file_path
);

insert into public.feedbacks (
  order_id,
  nps,
  score_quality,
  free_text,
  would_recommend,
  submitted_at
)
select
  order_id,
  case
    when rating >= 5 then 10
    when rating = 4 then 8
    when rating = 3 then 6
    when rating = 2 then 3
    else 0
  end,
  rating,
  comment,
  rating >= 4,
  created_at
from public.reviews
where not exists (
  select 1 from public.feedbacks
  where feedbacks.order_id = reviews.order_id
);

-- Keep legacy enum values in place for now. The actual order_status UPDATE
-- should run after the API has been moved to Phase 1 states, because changing
-- enum values early can break current MVP code paths.
--
-- Draft mapping for later controlled migration:
-- draft -> inquiry
-- submitted -> inquiry
-- reservation_pending -> paid or payment_pending, depending on payment row
-- reservation_confirmed -> scheduled
-- preparing -> scheduled
-- in_service -> in_progress
-- completed -> done
-- cancelled -> canceled
