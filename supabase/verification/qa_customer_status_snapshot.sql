SELECT status, COUNT(*) AS cnt
FROM orders
GROUP BY status
ORDER BY cnt DESC;

SELECT id, order_number, status, access_token IS NOT NULL AS has_token
FROM orders
ORDER BY created_at DESC
LIMIT 5;

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
