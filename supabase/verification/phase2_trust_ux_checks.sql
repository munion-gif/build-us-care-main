SELECT 'faqs_table_exists' AS check, COUNT(*) AS value
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'faqs';

SELECT 'active_faq_count' AS check, COUNT(*) AS value
FROM public.faqs
WHERE is_active = true;

SELECT 'technician_profile_columns' AS check, COUNT(*) AS value
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'technicians'
  AND column_name IN ('experience_years', 'specialties', 'bio', 'profile_image_url');

SELECT
  'faq_rls_force' AS check,
  relrowsecurity AS row_security,
  relforcerowsecurity AS force_row_security
FROM pg_class
WHERE oid = 'public.faqs'::regclass;
