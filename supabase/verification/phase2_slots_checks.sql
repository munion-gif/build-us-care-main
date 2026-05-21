SELECT 'slot_configs_table_exists' AS check,
  COUNT(*) AS value
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'slot_configs';

SELECT 'reservations_slot_unique_removed' AS check,
  COUNT(*) AS value
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'reservations_confirmed_slot_uq';

SELECT 'slot_configs_rls' AS check,
  c.relrowsecurity AS rowsecurity,
  c.relforcerowsecurity AS forcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'slot_configs';

SELECT 'slot_configs_policy_count' AS check,
  COUNT(*) AS value
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'slot_configs';
