-- Active technician and slot-cap operating snapshot.
SELECT id, name, phone, region, is_active
FROM technicians
WHERE is_active = true
ORDER BY created_at;

SELECT key, value
FROM app_configs
WHERE key IN ('slot_cap', 'slot_cap_morning', 'slot_cap_afternoon')
ORDER BY key;

SELECT
  DATE(j.scheduled_at AT TIME ZONE 'Asia/Seoul') AS work_date,
  CASE
    WHEN EXTRACT(hour FROM j.scheduled_at AT TIME ZONE 'Asia/Seoul') < 13 THEN '오전'
    ELSE '오후'
  END AS slot,
  COUNT(*) AS assigned_count,
  STRING_AGG(t.name, ', ' ORDER BY t.name) AS technicians
FROM jobs j
LEFT JOIN technicians t ON t.id = j.technician_id
WHERE j.status NOT IN ('cancelled')
  AND j.scheduled_at IS NOT NULL
  AND j.scheduled_at > NOW()
GROUP BY work_date, slot
ORDER BY work_date, slot;
