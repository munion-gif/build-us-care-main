# Order Status Mapping

기준: `OrderStatus` 코드 기준 정리 1차 구현 결과. DB migration, legacy data cleanup, admin jobs legacy status sync는 아직 반영하지 않았다.

## 1. 공식 운영 상태

신규 코드, 검증, 라벨, 관리자 기본 필터에서 사용하는 공식 `orders.status` 목록은 아래 12개다.

```text
inquiry
quoted
payment_pending
paid
scheduled
in_progress
completed
done
issue
warranty
cancel_requested
canceled
```

## 2. Deprecated/Alias 표시 정책

| 상태 | 정책 |
| --- | --- |
| `submitted` | 신규 저장 금지. 고객/관리자 UI에서는 `inquiry` 계열로 표시 |
| `draft` | 신규 저장 금지. 고객/관리자 UI에서는 `inquiry` 계열로 표시 |
| `reservation_pending` | 신규 저장 금지. UI에서는 `payment_pending` 계열로 표시 |
| `reservation_confirmed` | 신규 저장 금지. UI에서는 `scheduled` 계열로 표시 |
| `preparing` | 신규 저장 금지. UI에서는 `scheduled` 계열로 표시 |
| `in_service` | 신규 저장 금지. UI에서는 `in_progress` 계열로 표시 |
| `cancelled` | 주문 입력은 `canceled`로 정규화. UI에서는 `canceled` 계열로 표시. 작업/예약의 `cancelled`는 유지 |

## 3. 라벨 기준

| 상태 | 고객 라벨 | 관리자 라벨 |
| --- | --- | --- |
| `inquiry` | 문의 접수됨 | 문의 접수 |
| `quoted` | 견적 안내 완료 | 견적 완료 |
| `payment_pending` | 결제 대기 중 | 결제대기 |
| `paid` | 결제 완료, 기사 배정 중 | 결제완료 |
| `scheduled` | 방문 예약 확정 | 방문확정 |
| `in_progress` | 시공 중 | 시공중 |
| `completed` | 시공 완료, 검수 중 | 검수대기 |
| `done` | 시공 완료 | 완료 |
| `issue` | 시공 후 문제 확인 | 이슈 |
| `warranty` | A/S 접수됨 | A/S |
| `cancel_requested` | 취소 요청 처리 중 | 취소요청 |
| `canceled` | 주문 취소됨 | 취소 |

## 4. 허용 전이 요약

관리자 주문 상태 변경 기준은 `lib/status.ts`의 `ORDER_TRANSITIONS`를 따른다.

| 현재 상태 | 허용 다음 상태 |
| --- | --- |
| `inquiry` | `quoted`, `canceled` |
| `quoted` | `payment_pending`, `canceled` |
| `payment_pending` | `paid`, `canceled` |
| `paid` | `scheduled`, `cancel_requested`, `canceled` |
| `scheduled` | `in_progress`, `cancel_requested`, `canceled` |
| `in_progress` | `completed`, `issue`, `cancel_requested` |
| `completed` | `done`, `issue` |
| `done` | `warranty` |
| `issue` | `scheduled`, `in_progress`, `completed`, `done`, `canceled` |
| `warranty` | `scheduled`, `in_progress`, `done` |
| `cancel_requested` | `canceled`, `scheduled`, `paid` |
| `canceled` | 없음 |

주의:

- `inquiry -> payment_pending`은 허용하지 않는다.
- `completed -> warranty`는 허용하지 않는다.
- 고객 A/S 접수 UI/API는 기존처럼 `done` 기준을 유지한다.

## 5. 주요 사용 화면/API

| 영역 | 파일 |
| --- | --- |
| 타입/공식 상태 목록 | `lib/types.ts` |
| 검증/입력 정규화 | `lib/validation.ts` |
| 상태 전이 | `lib/status.ts` |
| 공통 관리자 라벨 | `lib/format.ts` |
| 고객 상태 라벨/타임라인 | `lib/order-status-label.ts` |
| 관리자 주문 상태 변경 API | `app/api/admin/orders/[id]/status/route.ts` |
| 관리자 주문 수정 API | `app/api/admin/orders/[id]/route.ts` |
| 관리자 주문 목록/필터 | `app/admin/orders/page.tsx` |
| 관리자 대시보드 badge | `app/admin/dashboard/page.tsx` |
| 고객 주문 상태 | `app/orders/[id]/order-status-client.tsx` |
| 고객 다음 액션 | `components/orders/NextActionCard.tsx` |
| 고객 현재 상태 패널 | `components/orders/OrderCurrentStatusPanel.tsx` |

## 6. 이번 구현에서 제외한 별도 작업

- `orders_status_allowed` CHECK에 `quoted`를 포함하는 DB migration
- 기존 `orders.status` legacy row 정리
  - `draft`
  - `reservation_pending`
  - `reservation_confirmed`
  - `preparing`
  - `in_service`
  - 주문 `cancelled`
- `app/api/admin/jobs/[id]/status/route.ts`의 legacy 주문 상태 동기화 정리
  - 현재 별도 작업 전까지 `preparing`, `in_service`, `cancelled` 동기화가 남아 있다.
- Toss confirm/webhook 계약 변경
- accessToken 기반 게스트 상태조회 인증 방식 변경
- 예약 슬롯/`reserve_order_slot` 동작 변경
