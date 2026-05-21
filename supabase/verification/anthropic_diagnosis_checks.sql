SELECT id, result, confidence, reason, service_type_code, created_at
FROM diagnoses
ORDER BY created_at DESC
LIMIT 3;

SELECT event_type, occurred_at
FROM events
WHERE event_type = 'diagnosis_requested'
ORDER BY occurred_at DESC
LIMIT 3;
