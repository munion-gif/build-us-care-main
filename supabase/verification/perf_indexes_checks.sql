SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_orders_status_created_at',
    'idx_orders_created_at',
    'idx_customers_phone_created_at',
    'idx_jobs_order_id',
    'idx_jobs_technician_scheduled_at',
    'idx_jobs_scheduled_at',
    'idx_reservations_reserved_date_time_slot',
    'idx_diagnoses_result_created_at',
    'idx_events_order_id_created_at',
    'idx_notifications_type_created_at',
    'idx_notifications_template_code_created_at'
  )
ORDER BY indexname;
