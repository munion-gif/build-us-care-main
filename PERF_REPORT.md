# 성능 최적화 2차 보고서

검증일: 2026-05-11

## 주요 측정값

이번 작업에서는 `lib/perf.ts`의 `measure()`를 주요 서버 데이터 로딩 지점에 추가했습니다. 배포 후 Vercel 함수 로그에서 `[perf]` 라벨로 실제 운영 측정값을 확인할 수 있습니다.

| 항목 | 최적화 전 | 최적화 후 | 비고 |
|---|---:|---:|---|
| `/admin/orders` 서버 데이터 로드 | 측정 로그 없음 | `[perf] admin.orders.*`로 계측 | select 축소 + 페이지네이션 + 병렬 fetch |
| `/admin/diagnoses` 목록 로드 | 측정 로그 없음 | `[perf] admin.diagnoses.*`로 계측 | 20건 페이지네이션 + select 축소 |
| `/admin/analytics` 집계 | 측정 로그 없음 | `[perf] admin.analytics.*`로 계측 | KPI/이벤트/판정/보증 집계 병렬화 |
| `/admin/technicians` 목록/주간 집계 | 측정 로그 없음 | `[perf] admin.technicians.*`로 계측 | 목록과 주간 집계 병렬화 |
| `/admin/slots` 월별 로드 | 순차 fetch 가능 | `[perf] admin.slots.loadSlots`로 계측 | slots/config/jobs 병렬 fetch |
| `/orders/[id]` 초기 설정 로드 | 측정 로그 없음 | `[perf] orders.status.fetchServicePhone`로 계측 | 주문 상세 API는 기존 통합 조회 유지 |
| `/quote/[serviceCode]` 초기 로드 | service item 중복 조회 | `[perf] quote.service.*`로 계측 | addon 조회에서 service 중복 fetch 제거 |

## 적용 항목

- `lib/perf.ts` 추가 후 주요 서버 로딩 구간 계측
- `/admin/orders` select 축소 및 20건 단위 페이지네이션 강화
- `/admin/diagnoses` select 축소 및 page 기반 20건 페이지네이션 강화
- `/admin/slots`의 slots/config/jobs fetch를 병렬화
- `/quote/[serviceCode]`에서 addon 조회 시 service item 중복 fetch 제거
- `/api/admin/orders` select 축소 및 count 기반 페이지네이션 응답 추가
- Supabase 운영 DB 인덱스 추가 및 `ANALYZE` 수행

## 추가된 인덱스

- `idx_orders_status_created_at`
- `idx_orders_created_at`
- `idx_customers_phone_created_at`
- `idx_jobs_order_id`
- `idx_jobs_technician_scheduled_at`
- `idx_jobs_scheduled_at`
- `idx_reservations_reserved_date_time_slot`
- `idx_diagnoses_result_created_at`
- `idx_events_order_id_created_at`
- `idx_notifications_template_code_created_at` 또는 `idx_notifications_type_created_at`

## 남은 과제

- Vercel 운영 함수 로그에서 `[perf]` 결과를 1~2일 수집한 뒤 800ms 이상 라벨을 별도 튜닝합니다.
- Supabase `pg_stat_statements`가 활성화되면 실제 평균 실행시간 기준으로 추가 인덱스를 조정합니다.
