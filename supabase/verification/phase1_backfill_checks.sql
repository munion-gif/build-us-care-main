-- Phase 1 migration verification checks.
-- Run after applying:
-- 202605070001_phase1_foundation.sql
-- 202605070002_phase1_existing_table_expansion.sql
-- 202605070003_phase1_data_backfill.sql
-- 202605070004_phase1_indexes_rls.sql

-- 1. New table existence.
select
  table_name,
  case when table_name is not null then 'ok' else 'missing' end as status
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'homes',
    'quotes',
    'technicians',
    'materials',
    'media',
    'inspections',
    'feedbacks',
    'warranty_cases'
  )
order by table_name;

-- 2. Backfill count parity.
-- These checks also support the post-cleanup state where legacy tables have
-- already been dropped by 202605070008_phase1_drop_legacy_tables.sql.
create temp table if not exists phase1_backfill_result (
  check_name text,
  source_count bigint,
  target_count bigint,
  status text
);

truncate table phase1_backfill_result;

do $$
begin
  if to_regclass('public.order_photos') is null then
    insert into phase1_backfill_result
    values (
      'order_photos_to_media',
      null,
      (select count(*) from public.media where type = 'inquiry' and order_id is not null),
      'legacy_source_dropped'
    );
  else
    execute $sql$
      insert into phase1_backfill_result
      select
        'order_photos_to_media',
        (select count(*) from public.order_photos),
        (select count(*) from public.media where type = 'inquiry' and order_id is not null),
        case
          when (select count(*) from public.order_photos) =
               (select count(*) from public.media where type = 'inquiry' and order_id is not null)
          then 'ok'
          else 'mismatch'
        end
    $sql$;
  end if;

  if to_regclass('public.reviews') is null then
    insert into phase1_backfill_result
    values (
      'reviews_to_feedbacks',
      null,
      (select count(*) from public.feedbacks),
      'legacy_source_dropped'
    );
  else
    execute $sql$
      insert into phase1_backfill_result
      select
        'reviews_to_feedbacks',
        (select count(*) from public.reviews),
        (select count(*) from public.feedbacks),
        case
          when (select count(*) from public.reviews) =
               (select count(*) from public.feedbacks)
          then 'ok'
          else 'mismatch'
        end
    $sql$;
  end if;
end $$;

select * from phase1_backfill_result order by check_name;

-- 3. Backfill missing rows.
create temp table if not exists phase1_backfill_missing_result (
  check_name text,
  missing_count bigint,
  status text
);

truncate table phase1_backfill_missing_result;

do $$
begin
  if to_regclass('public.order_photos') is null then
    insert into phase1_backfill_missing_result
    values ('missing_order_photos_in_media', null, 'legacy_source_dropped');
  else
    execute $sql$
      insert into phase1_backfill_missing_result
      select
        'missing_order_photos_in_media',
        count(*),
        case when count(*) = 0 then 'ok' else 'missing_rows' end
      from public.order_photos op
      where not exists (
        select 1
        from public.media m
        where m.order_id = op.order_id
          and m.file_path = op.file_path
      )
    $sql$;
  end if;

  if to_regclass('public.reviews') is null then
    insert into phase1_backfill_missing_result
    values ('missing_reviews_in_feedbacks', null, 'legacy_source_dropped');
  else
    execute $sql$
      insert into phase1_backfill_missing_result
      select
        'missing_reviews_in_feedbacks',
        count(*),
        case when count(*) = 0 then 'ok' else 'missing_rows' end
      from public.reviews r
      where not exists (
        select 1
        from public.feedbacks f
        where f.order_id = r.order_id
      )
    $sql$;
  end if;
end $$;

select * from phase1_backfill_missing_result order by check_name;

-- 4. RLS and FORCE RLS status.
select
  relname as table_name,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as force_rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'homes',
    'quotes',
    'technicians',
    'materials',
    'media',
    'inspections',
    'feedbacks',
    'warranty_cases'
  )
order by relname;

-- 5. Policy existence.
select
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'homes',
    'quotes',
    'technicians',
    'materials',
    'media',
    'inspections',
    'feedbacks',
    'warranty_cases'
  )
order by tablename, policyname;

-- 6. Sample rows for manual inspection.
select id, order_id, type, file_path, sort_order, created_at
from public.media
order by created_at desc
limit 10;

select id, order_id, nps, score_quality, would_recommend, submitted_at
from public.feedbacks
order by submitted_at desc
limit 10;
