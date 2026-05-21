DELETE FROM job_status_logs
WHERE job_id IN (
  SELECT j.id
  FROM jobs j
  JOIN orders o ON o.id = j.order_id
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM media
WHERE job_id IN (
  SELECT j.id
  FROM jobs j
  JOIN orders o ON o.id = j.order_id
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
)
OR order_id IN (
  SELECT o.id
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM inspections
WHERE job_id IN (
  SELECT j.id
  FROM jobs j
  JOIN orders o ON o.id = j.order_id
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM jobs
WHERE order_id IN (
  SELECT o.id
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM payment_events
WHERE payment_id IN (
  SELECT p.id
  FROM payments p
  JOIN orders o ON o.id = p.order_id
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM payments
WHERE order_id IN (
  SELECT o.id
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM reservations
WHERE order_id IN (
  SELECT o.id
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM quotes
WHERE order_id IN (
  SELECT o.id
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM notifications
WHERE order_id IN (
  SELECT o.id
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
);

DELETE FROM events
WHERE order_id IN (
  SELECT o.id
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = '010-9999-0001'
)
OR properties->>'source' = 'launch_rehearsal';

DELETE FROM orders
WHERE customer_id IN (
  SELECT id FROM customers WHERE phone = '010-9999-0001'
);

DELETE FROM homes
WHERE customer_id IN (
  SELECT id FROM customers WHERE phone = '010-9999-0001'
);

DELETE FROM customers
WHERE phone = '010-9999-0001';
