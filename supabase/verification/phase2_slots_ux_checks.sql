WITH job_slots AS (
  SELECT
    scheduled_at::date AS day,
    CASE WHEN EXTRACT(hour FROM scheduled_at) < 13 THEN 'morning' ELSE 'afternoon' END AS slot,
    COUNT(*) AS job_count
  FROM public.jobs
  WHERE status NOT IN ('cancelled')
    AND scheduled_at IS NOT NULL
  GROUP BY scheduled_at::date, slot
)
SELECT 'job_slot_counts' AS check, day, slot, job_count
FROM job_slots
ORDER BY day, slot;

WITH reservation_slots AS (
  SELECT
    reserved_date AS day,
    time_slot::text AS slot,
    COUNT(*) AS reservation_count
  FROM public.reservations
  WHERE status = 'confirmed'
  GROUP BY reserved_date, time_slot
)
SELECT 'reservation_slot_counts' AS check, day, slot, reservation_count
FROM reservation_slots
ORDER BY day, slot;

WITH combined AS (
  SELECT scheduled_at::date AS day,
    CASE WHEN EXTRACT(hour FROM scheduled_at) < 13 THEN 'morning' ELSE 'afternoon' END AS slot,
    COUNT(*) AS count
  FROM public.jobs
  WHERE status NOT IN ('cancelled')
    AND scheduled_at IS NOT NULL
  GROUP BY scheduled_at::date, slot
  UNION ALL
  SELECT reserved_date AS day,
    time_slot::text AS slot,
    COUNT(*) AS count
  FROM public.reservations
  WHERE status = 'confirmed'
    AND time_slot IN ('morning', 'afternoon')
  GROUP BY reserved_date, time_slot
)
SELECT 'over_cap_slots' AS check, day, slot, SUM(count) AS total_count, 3 AS default_cap
FROM combined
GROUP BY day, slot
HAVING SUM(count) >= 3
ORDER BY day, slot;

SELECT 'blocked_slot_config_dates' AS check, date, morning_cap, afternoon_cap, blocked
FROM public.slot_configs
WHERE blocked = true
ORDER BY date;

SELECT 'confirmed_before_min_date' AS check, COUNT(*) AS value
FROM public.reservations
WHERE status = 'confirmed'
  AND reserved_date < ((now() AT TIME ZONE 'Asia/Seoul')::date + 1);

SELECT 'reservation_slot_guard_function' AS check, COUNT(*) AS value
FROM pg_proc
WHERE proname = 'reserve_order_slot';
