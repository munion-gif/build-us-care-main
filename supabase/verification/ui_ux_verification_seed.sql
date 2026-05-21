SELECT id, access_token, order_number, status
FROM public.orders
ORDER BY created_at DESC
LIMIT 3;

SELECT id, name, phone, is_active, region
FROM public.technicians
ORDER BY created_at DESC
LIMIT 10;
