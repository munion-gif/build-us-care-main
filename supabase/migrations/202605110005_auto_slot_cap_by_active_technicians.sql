-- Return slot capacity to automatic active-technician based mode.
DELETE FROM public.app_configs
WHERE key = 'slot_cap';

DELETE FROM public.slot_configs
WHERE type = 'cap';
