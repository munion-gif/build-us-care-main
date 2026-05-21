# STATUS_CONSISTENCY_AUDIT

## 1. 범위와 기준

- 단계: 분석 단계
- 주제: 주문/작업/결제/예약 상태값 정합성 감사
- 기준 문서: `PROJECT_ARCHITECTURE_OVERVIEW.md`, `README.md`, `backend-spec.md`
- 기준 코드/마이그레이션:
  - `lib/types.ts`
  - `lib/validation.ts`
  - `lib/status.ts`
  - `lib/jobs.ts`
  - `lib/format.ts`
  - `lib/order-status-label.ts`
  - `app/api/**/route.ts`
  - `app/admin/**`
  - `app/orders/**`
  - `app/technician/**`
  - `supabase/migrations/*.sql`

이 문서는 실제 파일에서 확인한 상태값만 정리한다. 코드, DB migration, package 파일은 수정하지 않았다.

## 2. 핵심 결론

| 항목 | 결론 |
| --- | --- |
| 상태값 정의 위치 | `lib/types.ts`, `lib/validation.ts`, `lib/status.ts`, 개별 Route Handler, DB migration, UI 라벨 유틸에 분산되어 있다. |
| 가장 큰 불일치 | DB enum/CHECK, 타입/Zod, 운영 Route Handler가 서로 다른 세대의 상태값을 함께 사용한다. |
| 주문 상태 위험 | `quoted`, `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled`가 파일별로 다르게 취급된다. |
| 작업 상태 위험 | `completed`와 `done`/`inspected`가 동시에 존재하고, 전용 작업 완료/검수 API와 범용 상태 변경 API가 서로 다른 상태 체계를 쓴다. |
| 결제 상태 위험 | DB에는 `refunded`가 추가되어 있지만 `lib/types.ts`와 주요 UI 라벨은 `refunded`를 포함하지 않는다. |
| 예약 상태 위험 | DB/type은 네 가지 상태를 갖지만 생성 검증은 `pending`, `confirmed`만 허용하고, 예약/리스케줄 API의 보호 상태 목록이 주문 상태 전체와 완전히 일치하지 않는다. |

## 3. 상태 도메인별 감사 표

| 상태 도메인 | 정의 파일 | 상태값 목록 | 사용하는 주요 UI/Route Handler 파일 | 불일치/모호한 부분 | 회귀 위험 포인트 |
| --- | --- | --- | --- | --- | --- |
| `OrderStatus` | `lib/types.ts` | `inquiry`, `submitted`, `payment_pending`, `paid`, `scheduled`, `in_progress`, `completed`, `done`, `issue`, `warranty`, `cancel_requested`, `canceled`, `cancelled` | `app/api/orders/route.ts`, `app/api/quote/route.ts`, `app/api/quotes/[id]/accept/route.ts`, `app/api/payments/toss/confirm/route.ts`, `app/api/orders/[id]/reservation/route.ts`, `app/api/orders/[id]/reschedule/route.ts`, `app/api/orders/[id]/cancel/route.ts`, `app/api/orders/[id]/warranty/route.ts`, `app/api/admin/orders/[id]/status/route.ts`, `app/api/admin/orders/[id]/route.ts`, `app/api/admin/jobs/[id]/start/route.ts`, `app/api/admin/jobs/[id]/complete/route.ts`, `app/api/admin/jobs/[id]/inspect/route.ts`, `app/api/technician/jobs/[id]/start/route.ts`, `app/api/technician/jobs/[id]/complete/route.ts`, `app/orders/[id]/order-status-client.tsx`, `app/admin/orders/page.tsx`, `app/admin/orders/[id]/page.tsx`, `app/admin/dashboard/page.tsx` | DB migration에는 `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `quoted`, `cancelled`도 존재한다. `lib/types.ts`에는 `quoted`, `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`가 없다. `supabase/migrations/202605110006_cancellations.sql`의 `orders_status_allowed` CHECK 목록에는 `quoted`가 없지만 `app/api/quote/route.ts`는 주문을 `quoted`로 갱신한다. | 견적 생성, 관리자 상태 변경, 작업 상태 동기화, 주문 상세 UI, 취소 승인/거절에서 상태 검증 또는 라벨 누락이 발생할 수 있다. |
| 주문 상태 검증 | `lib/validation.ts`, `app/api/admin/orders/[id]/route.ts` | `inquiry`, `submitted`, `payment_pending`, `paid`, `scheduled`, `in_progress`, `completed`, `done`, `issue`, `warranty`, `cancel_requested`, `canceled`, `cancelled` | `app/api/admin/orders/[id]/status/route.ts`, `app/api/admin/orders/[id]/route.ts` | `app/api/admin/orders/[id]/route.ts`는 입력 `cancelled`를 `canceled`로 정규화한다. 반면 DB와 일부 API는 `cancelled`도 사용한다. | `canceled`/`cancelled` 혼재로 필터, 통계, 상태조회에서 일부 주문이 빠질 수 있다. |
| 주문 상태 전이 | `lib/status.ts` | `inquiry -> submitted/payment_pending/canceled`, `submitted -> payment_pending/canceled`, `payment_pending -> paid/canceled`, `paid -> scheduled/cancel_requested/canceled`, `scheduled -> in_progress/cancel_requested/canceled`, `in_progress -> completed/issue`, `completed -> done/issue`, `done -> warranty`, `issue -> scheduled/done/canceled`, `warranty -> scheduled/done`, `cancel_requested -> canceled/scheduled/paid`, `canceled -> []` | `app/api/admin/orders/[id]/status/route.ts` | 전이표에는 DB/Route에서 쓰는 `quoted`, `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled`가 없다. | 범용 관리자 상태 변경 API가 DB에 존재하는 일부 주문 상태를 읽거나 이동할 때 실패할 수 있다. |
| `JobStatus` | `lib/types.ts`, `lib/validation.ts` | `received`, `material_ready`, `assigned`, `scheduled`, `in_progress`, `completed`, `cancelled` | `app/api/admin/jobs/[id]/status/route.ts`, `app/api/admin/jobs/[id]/assign/route.ts`, `app/api/admin/jobs/[id]/report-video/route.ts`, `app/admin/jobs/page.tsx`, `app/admin/orders/[id]/page.tsx` | DB migration에는 `checked_in`, `done`, `inspected`도 있다. `lib/types.ts`와 `jobStatusPatchSchema`는 이 세 값을 포함하지 않는다. | 관리자 범용 작업 상태 변경 API가 Phase 1 작업 흐름의 `done`, `inspected`, `checked_in`을 처리하지 못한다. |
| Phase 1 작업 상태 | `lib/jobs.ts` | `scheduled`, `in_progress`, `done`, `inspected` | `app/api/admin/jobs/[id]/start/route.ts`, `app/api/admin/jobs/[id]/complete/route.ts`, `app/api/admin/jobs/[id]/inspect/route.ts`, `app/api/technician/jobs/[id]/start/route.ts`, `app/api/technician/jobs/[id]/complete/route.ts`, `app/admin/jobs/jobs-client.tsx`, `app/technician/[jobId]/technician-job-detail-client.tsx` | 전용 시작/완료/검수 API는 `scheduled -> in_progress -> done -> inspected` 흐름을 사용한다. 기존 타입/범용 상태 변경 API는 `completed`를 완료 상태로 사용한다. | 작업 완료 후 검수 전 상태가 `done`인데, 다른 코드가 `completed`를 기대하면 UI 버튼, 필터, 상태 변경이 어긋날 수 있다. |
| 작업 상태 전이 | `lib/status.ts` | `received -> material_ready/cancelled`, `material_ready -> assigned/cancelled`, `assigned -> scheduled/cancelled`, `scheduled -> in_progress/cancelled`, `in_progress -> completed/cancelled`, `completed -> []`, `cancelled -> []` | `app/api/admin/jobs/[id]/status/route.ts` | 전이표에는 `checked_in`, `done`, `inspected`가 없다. 반면 전용 작업 API와 DB enum에는 해당 상태가 있다. | 범용 작업 상태 변경과 기사/관리자 작업 수행 플로우가 서로 다른 완료 모델을 사용한다. |
| 작업 상태에서 주문 상태 동기화 | `app/api/admin/jobs/[id]/status/route.ts`, 전용 작업 Route Handler | 범용 API: `material_ready/assigned/scheduled -> preparing`, `in_progress -> in_service`, `completed -> completed`, `cancelled -> cancelled`. 전용 API: 시작 시 주문 `in_progress`, 완료 시 주문 `completed`, 검수 통과 시 주문 `done`, 검수 실패 시 주문 `issue` | `app/api/admin/jobs/[id]/status/route.ts`, `app/api/admin/jobs/[id]/start/route.ts`, `app/api/admin/jobs/[id]/complete/route.ts`, `app/api/admin/jobs/[id]/inspect/route.ts`, `app/api/technician/jobs/[id]/start/route.ts`, `app/api/technician/jobs/[id]/complete/route.ts` | 범용 API는 `preparing`, `in_service`, `cancelled` 같은 레거시 주문 상태를 쓴다. `lib/types.ts`의 주문 상태에는 `preparing`, `in_service`가 없고 `cancelled`는 정규화 대상과 혼재한다. | 작업 상태 변경이 주문 상태를 함께 바꾸므로, 한쪽 상태 체계를 고치면 주문/기사/관리자 화면 전체에 회귀가 생길 수 있다. |
| `PaymentStatus` | `lib/types.ts` | `ready`, `pending`, `done`, `failed`, `cancelled` | `app/api/payments/toss/confirm/route.ts`, `app/admin/orders/[id]/page.tsx`, `app/admin/dashboard/page.tsx`, `app/admin/analytics/page.tsx` | DB migration은 `refunded`를 추가한다. `lib/types.ts`와 주문 상세 결제 라벨은 `refunded`를 포함하지 않는다. Toss confirm API는 Toss `DONE`이면 내부 `done`, 아니면 `failed`로 저장한다. | 환불 상태가 결제 테이블에 저장되면 타입/라벨/통계에서 누락될 수 있다. Toss confirm 계약 변경 시 주문 `paid` 전이와 결제 `done` 집계가 동시에 영향받는다. |
| `ReservationStatus` | `lib/types.ts`, `lib/validation.ts`, DB enum | DB/type: `pending`, `confirmed`, `unavailable`, `cancelled`. 생성 검증: `pending`, `confirmed` | `app/api/orders/[id]/reservation/route.ts`, `app/api/orders/[id]/reschedule/route.ts`, `app/api/admin/orders/[id]/route.ts`, `app/orders/[id]/order-status-client.tsx`, `app/admin/orders/page.tsx`, `app/admin/dashboard/page.tsx` | `reservationSchema`는 `unavailable`, `cancelled` 생성을 허용하지 않는다. 리스케줄 API는 기존 예약을 `cancelled`로 갱신하고 새 예약을 `confirmed`로 만든다. | 예약 상태와 주문 상태가 함께 갱신된다. 예약 취소/변경 로직에서 `cancelled` 필터가 빠지면 슬롯 중복 또는 잘못된 예약 표시가 발생할 수 있다. |

## 4. DB migration 기준 상태값

| 테이블/enum | 파일 | 확인된 상태값 |
| --- | --- | --- |
| `order_status` enum 초기값 | `supabase/migrations/202605060001_init_backend_mvp.sql` | `draft`, `submitted`, `reservation_pending`, `reservation_confirmed`, `payment_pending`, `paid`, `preparing`, `in_service`, `completed`, `cancelled` |
| `order_status` enum 추가값 | `supabase/migrations/202605070001_phase1_foundation.sql`, `supabase/migrations/202605070002_phase1_existing_table_expansion.sql`, `supabase/migrations/202605110006_cancellations.sql` | `inquiry`, `quoted`, `scheduled`, `in_progress`, `done`, `canceled`, `issue`, `warranty`, `cancel_requested`, `cancelled` |
| `orders_status_allowed` CHECK | `supabase/migrations/202605110006_cancellations.sql` | `draft`, `submitted`, `inquiry`, `payment_pending`, `paid`, `scheduled`, `reservation_confirmed`, `preparing`, `in_progress`, `in_service`, `completed`, `done`, `canceled`, `cancelled`, `cancel_requested`, `issue`, `warranty` |
| `job_status` enum 초기값 | `supabase/migrations/202605060001_init_backend_mvp.sql` | `received`, `material_ready`, `assigned`, `scheduled`, `in_progress`, `completed`, `cancelled` |
| `job_status` enum 추가값 | `supabase/migrations/202605070001_phase1_foundation.sql`, `supabase/migrations/202605070007_phase1_jobs_operations.sql` | `checked_in`, `done`, `inspected` |
| `payment_status` enum | `supabase/migrations/202605060001_init_backend_mvp.sql`, `supabase/migrations/202605070001_phase1_foundation.sql` | `ready`, `pending`, `done`, `failed`, `cancelled`, `refunded` |
| `reservation_status` enum | `supabase/migrations/202605060001_init_backend_mvp.sql` | `pending`, `confirmed`, `unavailable`, `cancelled` |

주의: `app/api/quote/route.ts`는 주문 상태를 `quoted`로 갱신하지만, `supabase/migrations/202605110006_cancellations.sql`의 `orders_status_allowed` CHECK 목록에는 `quoted`가 없다.

## 5. 주요 상태 전이 흐름

| 흐름 | 파일 | 상태 변화 |
| --- | --- | --- |
| 주문 생성 | `app/api/orders/route.ts` | 주문 `inquiry`, 작업 `received` 생성 |
| 견적 생성/계산 | `app/api/quote/route.ts` | 주문 `quoted` 갱신 |
| 견적 수락 | `app/api/quotes/[id]/accept/route.ts` | 주문 `payment_pending` 갱신 |
| Toss 결제 승인 | `app/api/payments/toss/confirm/route.ts` | 결제 `done` 또는 `failed`, 성공 시 주문 `paid` |
| 예약 확정 | `app/api/orders/[id]/reservation/route.ts` | 예약 `confirmed`, 주문은 보호 상태가 아니면 `scheduled` |
| 리스케줄 | `app/api/orders/[id]/reschedule/route.ts` | 기존 예약 `cancelled`, 신규 예약 `confirmed`, 작업 `scheduled` 또는 `cancelled`, 주문 `scheduled` 또는 `paid` |
| 관리자 작업 배정 | `app/api/admin/jobs/route.ts` | 작업 `scheduled`, 주문 `scheduled` |
| 관리자 작업 담당자 배정 | `app/api/admin/jobs/[id]/assign/route.ts` | 일정 있으면 작업 `scheduled`, 없으면 `assigned` |
| 관리자/기사 작업 시작 | `app/api/admin/jobs/[id]/start/route.ts`, `app/api/technician/jobs/[id]/start/route.ts` | 작업 `scheduled -> in_progress`, 주문 `in_progress` |
| 관리자/기사 작업 완료 | `app/api/admin/jobs/[id]/complete/route.ts`, `app/api/technician/jobs/[id]/complete/route.ts` | 작업 `in_progress -> done`, 주문 `completed` |
| 관리자 작업 검수 | `app/api/admin/jobs/[id]/inspect/route.ts` | 작업 `done -> inspected`, 주문 `done` 또는 `issue` |
| 관리자 완료 영상 보고 | `app/api/admin/jobs/[id]/report-video/route.ts` | 작업 `completed`, 주문 `completed` |
| 범용 관리자 작업 상태 변경 | `app/api/admin/jobs/[id]/status/route.ts` | 작업 전이표 기준 변경, 주문은 `preparing`/`in_service`/`completed`/`cancelled`로 동기화 |
| 고객 취소 요청 | `app/api/orders/[id]/cancel/route.ts` | 자동 취소 시 주문 `canceled`, 작업 `cancelled`; 수동 검토 시 주문 `cancel_requested` |
| 관리자 취소 승인 | `app/api/admin/cancellations/[id]/approve/route.ts` | 취소 `completed`, 작업 `cancelled`, 주문 `canceled` |
| 관리자 취소 거절 | `app/api/admin/cancellations/[id]/reject/route.ts` | 취소 `rejected`, 주문 `scheduled` 또는 `paid` 복구 |
| A/S 요청 | `app/api/orders/[id]/warranty/route.ts` | 주문 `done -> warranty`, 보증 케이스 `open` 생성 |
| 피드백 등록 | `app/api/orders/[id]/feedback/route.ts` | 주문 상태 변경 없음. 허용 상태는 `paid`, `completed`, `done` |

## 6. UI/라벨 사용 지점

| 파일 | 상태값 사용 방식 | 정합성 이슈 |
| --- | --- | --- |
| `lib/format.ts` | `formatOrderStatus()`가 주문/작업 상태 라벨을 함께 처리한다. | `reservation_confirmed`, `inspected` 라벨은 있지만 `quoted`, `draft`, `reservation_pending`, `preparing`, `in_service`, `refunded` 라벨은 없다. |
| `lib/order-status-label.ts` | 고객 주문 상세용 `getOrderStatusLabel()`, `getJobStatusLabel()` 제공 | 로컬 `OrderStatus`에는 `reservation_confirmed`가 있지만 `quoted`가 없다. 로컬 `JobStatus`는 `pending`, `done`, `inspected`, `warranty` 등을 포함해 `lib/types.ts`와 다르다. |
| `app/orders/[id]/order-status-client.tsx` | 고객 상태조회, 취소/예약변경/A/S/피드백 CTA 조건 처리 | 취소 가능: `paid`, `scheduled`. 리스케줄 제한: 작업 `in_progress`, `done`, `inspected` 및 주문 `warranty`, `issue`, `completed`, `done`, `canceled`, `cancelled`. A/S는 주문 `done`에서만 표시된다. |
| `app/admin/orders/page.tsx` | 관리자 주문 필터 상태 목록 | 필터에는 `inquiry`, `paid`, `scheduled`, `in_progress`, `completed`, `done`, `issue`, `warranty`, `cancel_requested`, `canceled`만 있다. `submitted`, `payment_pending`, `quoted`, `cancelled`, 레거시 상태는 없다. |
| `app/admin/dashboard/page.tsx` | 주문/작업 상태 badge와 집계 | 작업 활성 상태에 `checked_in`을 포함한다. 다른 타입/전이 파일에는 `checked_in`이 없다. |
| `app/admin/jobs/jobs-client.tsx` | 작업 버튼 조건 | `scheduled`에서 시작, `in_progress`에서 완료, `done`에서 검수 버튼을 표시한다. |
| `app/technician/[jobId]/technician-job-detail-client.tsx` | 기사 작업 버튼 조건 | `scheduled`에서 시작, `in_progress`에서 완료. 그 외는 완료된 작업으로 표시한다. |
| `app/admin/orders/[id]/page.tsx` | 주문 상세 결제/작업/예약 표시 | 결제 라벨은 `done`, `failed`, `pending` 중심이다. 작업 상태도 `formatOrderStatus()`로 표시한다. |

## 7. 회귀 위험 구간

| 위험 구간 | 실제 근거 파일 | 위험 내용 |
| --- | --- | --- |
| `quoted` 누락 | `app/api/quote/route.ts`, `supabase/migrations/202605110006_cancellations.sql`, `lib/types.ts`, `lib/status.ts`, `lib/format.ts` | 견적 API는 `quoted`를 쓰지만 타입/전이/라벨/CHECK가 모두 같은 기준을 공유하지 않는다. |
| `completed` vs `done` 분리 | `app/api/admin/jobs/[id]/complete/route.ts`, `app/api/admin/jobs/[id]/inspect/route.ts`, `app/api/admin/jobs/[id]/report-video/route.ts`, `lib/status.ts`, `lib/jobs.ts` | 작업 완료 API는 작업 `done`, 주문 `completed`를 쓰고 검수 통과 후 주문 `done`이 된다. 별도 영상 보고 API는 작업/주문 모두 `completed`를 쓴다. |
| `canceled` vs `cancelled` 혼재 | `lib/types.ts`, `lib/validation.ts`, `app/api/admin/orders/[id]/route.ts`, `app/api/orders/[id]/cancel/route.ts`, `app/api/admin/cancellations/[id]/approve/route.ts`, `app/api/orders/[id]/reschedule/route.ts` | 미국식/영국식 취소 상태가 공존한다. 주문은 `canceled` 중심, 작업/예약은 `cancelled` 중심으로 사용된다. |
| 범용 작업 상태 변경 API | `app/api/admin/jobs/[id]/status/route.ts`, `lib/status.ts` | 범용 API는 `completed` 기반 전이와 `preparing`/`in_service` 주문 동기화를 사용한다. Phase 1 전용 작업 API는 `done`/`inspected` 기반이다. |
| 상태 라벨 유틸 분산 | `lib/format.ts`, `lib/order-status-label.ts`, `app/admin/dashboard/page.tsx`, `app/admin/orders/page.tsx` | 같은 상태라도 화면마다 라벨/색상/필터 포함 여부가 다르다. 신규 상태 추가 시 일부 화면에서 원문 상태가 노출될 수 있다. |
| 예약/작업/주문 동시 갱신 | `app/api/orders/[id]/reservation/route.ts`, `app/api/orders/[id]/reschedule/route.ts`, `app/api/admin/jobs/route.ts` | 예약 생성/변경은 예약, 작업, 주문 상태를 함께 바꾼다. 보호 상태 목록이 주문 상태 전체와 일치하지 않으면 완료/취소/이슈 주문이 잘못 갱신될 수 있다. |
| 결제 환불 상태 | `supabase/migrations/202605070001_phase1_foundation.sql`, `lib/types.ts`, `app/admin/orders/[id]/page.tsx` | DB에는 `refunded`가 있지만 타입과 주요 UI 라벨에는 없다. 환불 기능 추가/연동 시 누락 위험이 있다. |
| 피드백 허용 상태 | `app/api/orders/[id]/feedback/route.ts`, `app/orders/[id]/order-status-client.tsx` | API는 `paid`, `completed`, `done`을 허용하지만 고객 UI의 피드백 CTA는 `done`/`completed` 기준이다. |

## 8. 작업 전에 읽어야 할 파일 묶음

| 작업 종류 | 먼저 확인할 파일 |
| --- | --- |
| 주문 상태 추가/변경 | `lib/types.ts`, `lib/validation.ts`, `lib/status.ts`, `lib/format.ts`, `lib/order-status-label.ts`, `app/api/admin/orders/[id]/status/route.ts`, `app/api/admin/orders/[id]/route.ts`, `supabase/migrations/*.sql` |
| 작업 상태 추가/변경 | `lib/types.ts`, `lib/validation.ts`, `lib/status.ts`, `lib/jobs.ts`, `app/api/admin/jobs/[id]/status/route.ts`, `app/api/admin/jobs/[id]/start/route.ts`, `app/api/admin/jobs/[id]/complete/route.ts`, `app/api/admin/jobs/[id]/inspect/route.ts`, `app/api/technician/jobs/[id]/start/route.ts`, `app/api/technician/jobs/[id]/complete/route.ts` |
| 예약 변경 | `app/api/orders/[id]/reservation/route.ts`, `app/api/orders/[id]/reschedule/route.ts`, `app/api/admin/orders/[id]/route.ts`, `supabase/migrations/*reserve_order_slot*.sql`, `supabase/migrations/*.sql` |
| 결제/환불 변경 | `app/api/payments/toss/confirm/route.ts`, `app/api/payments/toss/webhook/route.ts`, `lib/types.ts`, `app/admin/orders/[id]/page.tsx`, `supabase/migrations/*.sql` |
| 고객 상태조회 UI 변경 | `app/orders/[id]/order-status-client.tsx`, `lib/order-status-label.ts`, `lib/format.ts`, `app/api/orders/[id]/status/route.ts` |
| 관리자 운영 화면 변경 | `app/admin/orders/page.tsx`, `app/admin/orders/[id]/page.tsx`, `app/admin/dashboard/page.tsx`, `app/admin/jobs/page.tsx`, `app/admin/jobs/jobs-client.tsx` |

## 9. 다음 계획 단계에서 다룰 권장 작업 단위

1. `OrderStatus` 기준값 정리 계획
   - DB enum/CHECK, `lib/types.ts`, `lib/validation.ts`, `lib/status.ts`, 라벨 유틸의 기준값을 어떻게 맞출지 계획한다.
   - 특히 `quoted`, `preparing`, `in_service`, `cancelled` 처리 방침을 먼저 결정해야 한다.

2. `JobStatus` Phase 1 전이 정리 계획
   - `completed` 기반 레거시 흐름과 `done`/`inspected` 기반 Phase 1 흐름 중 운영 기준을 정한다.
   - `app/api/admin/jobs/[id]/status/route.ts`와 전용 작업 API의 역할을 분리하거나 통합하는 계획이 필요하다.

3. 상태 라벨/필터 단일화 계획
   - `lib/format.ts`, `lib/order-status-label.ts`, 관리자 badge/filter 목록을 하나의 기준으로 맞추는 계획을 세운다.
   - UI만 고치더라도 API/DB 계약은 바꾸지 않는 범위부터 계획하는 것이 안전하다.

4. 결제 환불 상태 대응 계획
   - DB의 `refunded`를 코드 타입/라벨/통계에서 어떻게 취급할지 결정한다.
   - Toss confirm/webhook 계약은 별도 승인 전까지 변경하지 않는다.

5. 예약-주문-작업 상태 동기화 감사
   - `reserve_order_slot`, 예약 생성, 리스케줄, 관리자 작업 배정이 주문 상태를 언제 바꾸는지 별도 문서로 더 좁혀 감사한다.

## 10. 검증

- 수행한 검증: 문서/코드/마이그레이션 파일 정적 분석
- 실행하지 않은 검증: `npm run typecheck`, `npm run build`, DB migration 적용
- 실행하지 않은 이유: 현재 요청은 분석 단계이며, 코드/DB/package 변경 및 실행 검증이 아니라 문서 작성만 요구했다.
