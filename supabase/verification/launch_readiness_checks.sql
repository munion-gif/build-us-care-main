-- Launch readiness snapshot.
-- Run against the production database before release checks.

SELECT event_type, COUNT(*) AS cnt, MAX(occurred_at) AS last_at
FROM events
GROUP BY event_type
ORDER BY cnt DESC;

SELECT status, COUNT(*) AS cnt
FROM orders
GROUP BY status
ORDER BY cnt DESC;

SELECT id, name, phone, is_active, created_at
FROM technicians
ORDER BY created_at DESC
LIMIT 10;

SELECT key, value
FROM app_configs
WHERE key IN ('kakao_channel_url', 'kakao_channel_id', 'service_phone', 'slot_cap', 'maintenance_mode')
ORDER BY key;
