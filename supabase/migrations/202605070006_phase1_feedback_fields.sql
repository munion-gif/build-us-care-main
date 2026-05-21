-- Add Phase 1 customer-facing feedback fields while preserving existing NPS columns.

alter table public.feedbacks
  add column if not exists rating integer check (rating between 1 and 5),
  add column if not exists comment text,
  add column if not exists categories jsonb not null default '{}'::jsonb;

alter table public.feedbacks
  alter column nps drop not null;

update public.feedbacks
set
  rating = coalesce(rating, score_quality),
  comment = coalesce(comment, free_text),
  categories = case
    when categories <> '{}'::jsonb then categories
    else jsonb_strip_nulls(jsonb_build_object(
      'speed', score_time,
      'quality', score_quality,
      'kindness', score_response,
      'cleanliness', score_clean,
      'price', score_price
    ))
  end
where rating is null or comment is null or categories = '{}'::jsonb;
