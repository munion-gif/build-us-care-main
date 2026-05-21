SELECT c.phone
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE c.phone IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 1;
