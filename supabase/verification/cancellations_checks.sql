SELECT 'cancellations_table_exists' AS check_name,
  COUNT(*) AS value
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'cancellations';

SELECT 'order_payment_key_column_exists' AS check_name,
  COUNT(*) AS value
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name = 'payment_key';

SELECT 'cancel_policy_config_count' AS check_name,
  COUNT(*) AS value
FROM app_configs
WHERE key IN (
  'cancel_policy_full_refund_hours',
  'cancel_policy_full_refund_days_before',
  'cancel_policy_partial_refund_rate',
  'cancel_policy_no_refund_status'
);

SELECT 'pending_cancel_requests' AS check_name,
  COUNT(*) AS value
FROM cancellations
WHERE status = 'pending';

SELECT 'cancel_requested_orders' AS check_name,
  COUNT(*) AS value
FROM orders
WHERE status = 'cancel_requested';
