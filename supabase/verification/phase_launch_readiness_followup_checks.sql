SELECT key, value
FROM public.app_configs
WHERE key IN ('kakao_channel_url', 'admin_email', 'admin_phone', 'notify_channel', 'warranty_period_days', 'warranty_reminder_days')
ORDER BY key;

SELECT COUNT(*) AS active_technician_count
FROM public.technicians
WHERE COALESCE(is_active, true) = true;

SELECT COUNT(*) AS notification_setting_count
FROM public.app_configs
WHERE key IN ('admin_email', 'admin_phone', 'notify_channel');
