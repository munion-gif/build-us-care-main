-- Phase 1 cleanup: drop MVP legacy tables replaced by Phase 1 tables.
-- Replacements:
-- order_photos -> media
-- reviews -> feedbacks
-- addresses -> homes
-- order_items -> orders.skus + quotes.items

drop table if exists public.order_photos cascade;
drop table if exists public.reviews cascade;
drop table if exists public.addresses cascade;
drop table if exists public.order_items cascade;
