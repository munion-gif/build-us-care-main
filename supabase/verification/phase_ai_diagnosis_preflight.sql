-- 최근 7일 집/가구 맥락 저장 현황
SELECT
  h.floor,
  h.complex_id,
  c.household_size,
  c.has_kids,
  c.has_elderly,
  COUNT(*) AS cnt
FROM orders o
LEFT JOIN homes h ON h.id = o.home_id
LEFT JOIN customers c ON c.id = o.customer_id
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY h.floor, h.complex_id, c.household_size, c.has_kids, c.has_elderly
ORDER BY cnt DESC;

-- 이벤트 트래킹 발화 현황
SELECT event_type, COUNT(*) AS cnt, MAX(occurred_at) AS last_at
FROM events
GROUP BY event_type
ORDER BY cnt DESC;

-- diagnoses 현재 구조
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'diagnoses'
ORDER BY ordinal_position;

-- 기존 판정 데이터
SELECT
  id,
  order_id,
  result,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'diagnoses'
        AND column_name = 'confidence'
    )
    THEN to_jsonb(diagnoses)->>'confidence'
    ELSE null
  END AS confidence,
  created_at
FROM diagnoses
ORDER BY created_at DESC
LIMIT 10;
