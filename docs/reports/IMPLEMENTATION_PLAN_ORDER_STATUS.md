# IMPLEMENTATION_PLAN_ORDER_STATUS

## 1. 범위

- 단계: 계획 단계
- 작업 목표: `OrderStatus` 기준값을 정리하고 DB enum/CHECK, TypeScript 타입, Zod 검증, 상태 전이 유틸, 라벨/필터 기준을 일치시키는 구현 계획 수립
- 참고 문서:
  - `PROJECT_ARCHITECTURE_OVERVIEW.md`
  - `STATUS_CONSISTENCY_AUDIT.md`
  - `README.md`
  - `backend-spec.md`

이 문서는 계획과 영향 분석만 담는다. 코드, DB migration, package 파일은 수정하지 않는다.

## 2. 운영 기준 OrderStatus 제안

### 2.1 공식 운영 상태

현재 코드와 Phase 1 운영 흐름을 모두 반영해, 신규 코드/검증/라벨/필터의 기준은 아래 상태로 제안한다.

| 상태 | 운영 의미 | 유지 이유 |
| --- | --- | --- |
| `inquiry` | 고객 의뢰 접수 | `app/api/orders/route.ts`가 신규 주문 생성 시 사용한다. |
| `quoted` | 견적 생성/발송 | `app/api/quote/route.ts`가 견적 저장 후 사용한다. `backend-spec.md` canonical 흐름에도 있다. |
| `payment_pending` | 견적 수락 후 결제 대기 | `app/api/quotes/[id]/accept/route.ts`가 사용한다. |
| `paid` | 결제 완료 | `app/api/payments/toss/confirm/route.ts`가 사용한다. 예약/기사 배정 전 기준 상태다. |
| `scheduled` | 방문 일정 확정 | 예약 확정, 관리자 기사 배정 후 사용한다. |
| `in_progress` | 시공 진행 중 | 관리자/기사 작업 시작 API가 사용한다. |
| `completed` | 시공 완료, 검수 또는 최종 확인 전 | 현재 전용 작업 완료 API가 주문에 기록한다. 고객 피드백 API도 허용한다. |
| `done` | 검수 통과 또는 최종 완료 | `app/api/admin/jobs/[id]/inspect/route.ts`, A/S 요청 조건에서 사용한다. |
| `issue` | 검수 실패 또는 이슈 상태 | 검수 실패 시 주문에 기록한다. |
| `warranty` | A/S 요청/처리 상태 | `app/api/orders/[id]/warranty/route.ts`가 사용한다. |
| `cancel_requested` | 고객 취소 요청, 관리자 검토 대기 | 취소 승인/반려 플로우에서 사용한다. |
| `canceled` | 최종 취소 | 주문 취소 저장 기준으로 통일한다. |

### 2.2 Deprecated 상태

아래 상태는 새 코드, 새 라벨, 새 관리자 필터에서 사용하지 않는 방향으로 계획한다.

| 상태 | 처리 방안 | 이유 |
| --- | --- | --- |
| `cancelled` | 주문 저장값에서는 deprecated. 입력/기존 DB row는 `canceled`로 정규화한다. | 주문은 미국식 `canceled`로 통일하고, 작업/예약의 `cancelled`와 분리한다. |
| `draft` | 주문 운영 상태에서는 deprecated. 기존 row는 조회 시 `inquiry` 라벨로 표시하고, 별도 migration 단계에서 `inquiry`로 정리 검토. | 현재 신규 주문 생성 코드가 사용하지 않는다. `backend-spec.md`도 `inquiry` 흡수를 제안한다. |
| `reservation_pending` | 주문 운영 상태에서는 deprecated. 기존 row는 결제 여부에 따라 `payment_pending` 또는 `paid`로 정리하는 별도 데이터 migration 검토. | 예약 대기는 예약 도메인 상태로 분리되어야 한다. |
| `reservation_confirmed` | 주문 운영 상태에서는 deprecated. 기존 row는 `scheduled` 라벨로 표시한다. | 방문 일정 확정은 현재 주문 `scheduled`와 예약 `confirmed` 조합으로 표현한다. |
| `preparing` | 주문 운영 상태에서는 deprecated. 기존 row는 `scheduled` 계열 라벨로 표시한다. | 작업 준비는 작업 상태 또는 관리자 메모/자재 상태로 분리하는 편이 명확하다. |
| `in_service` | 주문 운영 상태에서는 deprecated. 기존 row는 `in_progress` 라벨로 표시한다. | 현재 전용 작업 시작 API는 주문 `in_progress`를 쓴다. |

### 2.3 Legacy read-only 상태

`submitted`은 완전 삭제보다 legacy read-only로 남기는 것을 제안한다.

| 상태 | 처리 방안 | 이유 |
| --- | --- | --- |
| `submitted` | DB 허용 및 조회 라벨은 유지하되, 신규 저장/관리자 수동 변경 대상에서는 제외한다. 라벨은 `inquiry`와 동일 계열로 표시한다. | `README.md`의 과거 MVP 흐름과 기존 데이터 호환 가능성이 있다. |

## 3. DB enum/CHECK와 코드 타입 일치 전략

### 3.1 원칙

| 계층 | 전략 |
| --- | --- |
| DB enum | 기존 데이터 호환을 위해 공식 운영 상태 + legacy/deprecated 상태를 당분간 모두 허용한다. |
| DB CHECK | enum과 모순되지 않도록 공식 운영 상태와 기존 legacy 상태를 모두 포함한다. 특히 `quoted` 누락을 해소해야 한다. |
| TypeScript 타입 | 두 층으로 나눈다. DB에서 읽을 수 있는 `DbOrderStatus`와 신규 코드가 쓸 `OperationalOrderStatus`를 구분한다. |
| Zod 검증 | 외부/관리자 입력은 `OperationalOrderStatus` 중심으로 제한한다. 단, 호환 입력 `cancelled`는 `canceled`로 정규화하는 별도 경로를 둔다. |
| 라벨/필터 | 고객/관리자 화면은 `OperationalOrderStatus` 중심으로 노출한다. Deprecated 상태는 alias 라벨만 제공하고 필터 기본 목록에서는 제외한다. |

### 3.2 DB 허용 상태 제안

DB는 다음 값을 허용하도록 맞추는 계획이 필요하다.

```text
inquiry
quoted
submitted
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
cancelled
draft
reservation_pending
reservation_confirmed
preparing
in_service
```

주의:

- `STATUS_CONSISTENCY_AUDIT.md` 기준으로 현재 `orders_status_allowed` CHECK에는 `quoted`가 빠져 있다.
- 구현 단계에서는 기존 CHECK 이름과 현재 DB 상태를 먼저 확인하고, `quoted`를 포함하는 migration을 별도 승인 후 작성해야 한다.
- 이 계획 단계에서는 migration 파일을 만들지 않는다.

### 3.3 코드 공식 subset 제안

신규 코드/검증/라벨/필터의 공식 subset은 다음으로 제한한다.

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

`submitted`, `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled`는 DB read compatibility 또는 alias 처리 대상으로 둔다.

## 4. 개별 상태 처리 방안

| 상태 | 제안 처리 |
| --- | --- |
| `quoted` | 공식 운영 상태로 승격한다. `lib/types.ts`, `lib/validation.ts`, `lib/status.ts`, `lib/format.ts`, `lib/order-status-label.ts`, 관리자 필터에 반영한다. DB CHECK에도 포함하는 별도 migration이 필요하다. |
| `draft` | deprecated. 신규 저장 금지. 라벨은 `문의 접수` 또는 `임시 접수`로 표시하되 관리자 기본 필터에서는 제외한다. 데이터 정리는 별도 migration 계획에서 `inquiry`로 전환 검토. |
| `reservation_pending` | deprecated. 신규 저장 금지. 주문 상태가 아니라 예약/결제 진행 상태로 해석한다. 기존 row는 결제/예약 데이터 확인 후 별도 정리한다. |
| `reservation_confirmed` | deprecated. 신규 저장 금지. UI 라벨은 `예약 확정`으로 표시 가능하지만 운영 필터 기준은 `scheduled`로 수렴한다. |
| `preparing` | deprecated. 신규 저장 금지. `app/api/admin/jobs/[id]/status/route.ts`의 작업 상태 동기화가 쓰는 값이므로, 해당 API 정리 전까지 DB read compatibility만 둔다. |
| `in_service` | deprecated. 신규 저장 금지. 작업 시작 동기화 기준은 `in_progress`로 수렴한다. |
| `canceled` | 주문 최종 취소 저장 기준값. 고객/관리자 UI 노출도 이 값을 기준으로 한다. |
| `cancelled` | 주문에서는 legacy alias. 입력받으면 `canceled`로 정규화한다. 작업/예약 상태에서는 계속 `cancelled`를 사용할 수 있으므로 도메인별 타입을 분리한다. |
| `submitted` | legacy read-only. 신규 저장 금지. 라벨은 `문의 접수` 계열로 유지한다. |
| `completed` | 공식 운영 상태로 유지하되 의미를 `작업 완료/검수 전`으로 고정한다. |
| `done` | 공식 운영 상태로 유지하되 의미를 `최종 완료`로 고정한다. |
| `issue` | 공식 운영 상태로 유지한다. 검수 실패, 현장 이슈 후 재방문 또는 완료 전환 대상으로 둔다. |
| `warranty` | 공식 운영 상태로 유지한다. A/S 요청 상태로 고객 UI에서 별도 안내한다. |
| `cancel_requested` | 공식 운영 상태로 유지한다. 고객 취소 요청 후 관리자 승인/반려 대기 상태다. |

## 5. `canceled` vs `cancelled` 정리 방안

| 구분 | 정책 |
| --- | --- |
| 주문 저장 값 | `orders.status`의 신규 저장값은 `canceled`만 사용한다. |
| 주문 입력 호환 | `cancelled` 입력은 API 경계에서 `canceled`로 정규화한다. |
| 주문 DB 호환 | 기존 `cancelled` row 조회는 허용하되 UI/응답에서는 `canceled` 의미로 라벨링한다. |
| 작업/예약 저장 값 | `jobs.status`, `reservations.status`는 기존 DB enum과 코드 기준에 따라 `cancelled`를 유지한다. |
| 고객 화면 | `canceled`, `cancelled` 모두 같은 취소 완료 문구로 표시한다. 원문 상태 노출은 피한다. |
| 관리자 화면 | 필터 기본값은 `canceled`만 둔다. 필요하면 고급/legacy 필터에서 `cancelled`를 별도 제공한다. |
| 데이터 정리 | 별도 승인된 migration 단계에서 `orders.status = 'cancelled'` row를 `canceled`로 갱신하는 계획을 세운다. 작업/예약은 대상에서 제외한다. |

## 6. 상태 전이 유틸 업데이트 방향

### 6.1 제안 전이표

`lib/status.ts`의 `ORDER_TRANSITIONS`는 공식 운영 상태 기준으로 아래 흐름을 목표로 한다.

| 현재 상태 | 허용 다음 상태 |
| --- | --- |
| `inquiry` | `quoted`, `payment_pending`, `canceled` |
| `quoted` | `payment_pending`, `canceled` |
| `payment_pending` | `paid`, `canceled` |
| `paid` | `scheduled`, `cancel_requested`, `canceled` |
| `scheduled` | `in_progress`, `cancel_requested`, `canceled` |
| `in_progress` | `completed`, `issue`, `cancel_requested` |
| `completed` | `done`, `issue`, `warranty` |
| `done` | `warranty` |
| `issue` | `scheduled`, `in_progress`, `completed`, `done`, `canceled` |
| `warranty` | `scheduled`, `in_progress`, `done` |
| `cancel_requested` | `canceled`, `scheduled`, `paid` |
| `canceled` | 없음 |

검토 포인트:

- `inquiry -> payment_pending`은 기존 `lib/status.ts`가 허용하던 `submitted` 우회 흐름을 대체하는 호환 전이다. 견적 생성 없이 결제 대기로 갈 수 있는 운영 케이스가 없다면 구현 단계에서 제거 후보로 둔다.
- `in_progress -> cancel_requested`는 현재 취소 정책과 환불 정책에 따라 제한될 수 있다. 이번 계획에서는 직접 Toss/환불 로직을 변경하지 않으므로, 실제 허용 여부는 취소 정책 문서와 함께 별도 승인 후 결정한다.
- `completed -> warranty`는 `warranty` API가 현재 `done`만 요구하므로, 고객 API 변경 없이 관리자 수동 변경에서만 허용할지 결정이 필요하다.

### 6.2 막을 전이

| 전이 | 차단 이유 |
| --- | --- |
| `paid -> in_progress` | 예약/기사 배정 없이 현장 진행으로 건너뛰면 예약/작업 데이터가 어긋난다. |
| `scheduled -> done` | 작업 시작/완료/검수 단계가 누락된다. |
| `completed -> paid` | 완료 후 결제 완료로 되돌리는 것은 환불/취소 정책과 충돌한다. |
| `done -> completed` | 최종 완료를 검수 전 완료로 되돌리는 것은 감사 로그와 고객 표시가 어긋난다. 필요한 경우 관리자 전용 별도 복구 액션으로 분리한다. |
| `canceled -> any` | 취소 완료는 terminal 상태로 둔다. 복구가 필요하면 별도 관리자 복구 플로우와 로그가 필요하다. |
| deprecated 상태로의 전이 | `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled`, `submitted` 신규 진입을 막는다. |

### 6.3 관리자 범용 상태 변경 API와의 관계

영향 파일:

- `app/api/admin/orders/[id]/status/route.ts`
- `app/api/admin/orders/[id]/route.ts`
- `lib/status.ts`
- `lib/validation.ts`

계획:

1. 관리자 주문 상태 변경 API는 `OperationalOrderStatus`만 입력으로 받는다.
2. legacy 상태가 DB에 있는 주문을 읽더라도, 다음 상태는 공식 운영 상태로만 이동시킨다.
3. `cancelled` 입력은 `canceled`로 정규화한다.
4. deprecated 상태로 수동 변경하는 기능은 제공하지 않는다.
5. 상태 변경 실패 응답에는 현재 상태와 허용 가능한 다음 상태를 내려 운영자가 원인을 알 수 있게 한다.

## 7. 라벨/필터 기준 정리 방향

### 7.1 라벨

영향 파일:

- `lib/format.ts`
- `lib/order-status-label.ts`

계획:

1. 주문 상태 라벨의 단일 기준 테이블을 만든다.
2. 고객용 라벨과 관리자용 라벨이 달라야 하면 같은 상태값 위에 presentation label만 분리한다.
3. Deprecated 상태도 라벨은 제공하되, 화면의 기본 액션 판단에는 쓰지 않는다.

제안 라벨:

| 상태 | 고객 라벨 | 관리자 라벨 |
| --- | --- | --- |
| `inquiry` | 접수 완료 | 문의 접수 |
| `quoted` | 견적 안내 | 견적 완료 |
| `payment_pending` | 결제 대기 | 결제 대기 |
| `paid` | 결제 완료 | 결제 완료 |
| `scheduled` | 방문 예정 | 방문 일정 확정 |
| `in_progress` | 시공 진행 중 | 시공 진행 중 |
| `completed` | 시공 완료 확인 중 | 작업 완료/검수 전 |
| `done` | 완료 | 최종 완료 |
| `issue` | 확인 필요 | 이슈 |
| `warranty` | A/S 접수 | A/S |
| `cancel_requested` | 취소 요청 확인 중 | 취소 요청 |
| `canceled` | 취소 완료 | 취소 완료 |

Legacy alias 라벨:

| 상태 | 표시 정책 |
| --- | --- |
| `submitted` | `inquiry`와 같은 계열로 표시 |
| `draft` | 관리자에서는 `임시/레거시 접수`, 고객에서는 `접수 확인 중` |
| `reservation_pending` | 관리자에서는 `예약 대기(레거시)`, 고객에서는 `일정 확인 중` |
| `reservation_confirmed` | `scheduled`와 같은 계열로 표시 |
| `preparing` | `scheduled`와 같은 계열로 표시 |
| `in_service` | `in_progress`와 같은 계열로 표시 |
| `cancelled` | `canceled`와 같은 계열로 표시 |

### 7.2 필터

관리자 기본 필터는 공식 운영 상태만 노출한다.

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

Deprecated 상태는 기본 필터에서 제외한다. 필요한 경우 별도 "레거시 상태 포함" 또는 직접 검색으로 분리한다.

## 8. 영향 범위

### 8.1 수정 후보 파일

계획 승인 후 구현 단계에서 수정 후보가 되는 파일이다.

| 파일 | 예상 변경 |
| --- | --- |
| `lib/types.ts` | `DbOrderStatus`, `OperationalOrderStatus`, legacy 상태 분리 또는 상수 기반 union 정리 |
| `lib/validation.ts` | 주문 상태 patch schema에 `quoted` 반영, deprecated 상태 입력 제한, `cancelled -> canceled` 정규화 경계 정리 |
| `lib/status.ts` | `ORDER_TRANSITIONS`를 공식 운영 상태 기준으로 재작성 |
| `lib/format.ts` | 주문 상태 라벨 보강, legacy alias 라벨 추가 |
| `lib/order-status-label.ts` | 고객용 상태 라벨/가이드에 `quoted`, legacy alias 반영 |
| `app/api/admin/orders/[id]/status/route.ts` | 공식 상태 전이만 허용하도록 검증 기준 정리 |
| `app/api/admin/orders/[id]/route.ts` | 로컬 `orderStatusSchema` 중복 제거 또는 공용 schema 사용, `cancelled` 정규화 유지 |
| `app/admin/orders/page.tsx` | 관리자 필터 목록에 공식 상태 반영 |
| `app/admin/dashboard/page.tsx` | badge/status grouping 정리 |
| `app/orders/[id]/order-status-client.tsx` | 고객 상태 가이드/CTA 조건에서 legacy alias 처리 |
| `app/admin/orders/[id]/page.tsx` | 상세 라벨과 상태 표시 정리 |
| `docs/order-status-mapping.md` | 기존 문서가 있다면 신규 기준 반영 |

### 8.2 DB migration 후보

계획 승인 후에도 DB 변경은 별도 승인 단위로 분리하는 것을 권장한다.

| 대상 | 예상 변경 |
| --- | --- |
| `orders_status_allowed` CHECK | `quoted` 포함. 공식 상태 + legacy 호환 상태 전체를 CHECK에 포함. |
| 기존 `orders.status = 'cancelled'` 데이터 | 별도 데이터 migration에서 `canceled`로 정리 검토. 작업/예약의 `cancelled`는 제외. |
| 기존 legacy 상태 데이터 | `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`는 실제 데이터 분포 확인 후 별도 migration 여부 결정. |

이번 계획의 구현 단계에서도 Toss 결제, accessToken 기반 상태조회, 예약/슬롯 동작 방식 자체는 직접 변경하지 않는다. 상태 라벨/검증/전이 기준 변경의 영향만 확인한다.

### 8.3 화면/API별 영향

| 경로/파일 | 영향 |
| --- | --- |
| `/quote/[serviceCode]`, `app/api/quote/route.ts` | `quoted`가 공식 상태가 되어 라벨/전이/CHECK와 일치해야 한다. API 호출 순서는 변경하지 않는다. |
| `/orders/lookup` | 조회 결과가 고객 상태 상세로 이어질 때 legacy 상태 라벨이 고객 친화적으로 표시되어야 한다. |
| `/orders/[id]`, `app/api/orders/[id]/status/route.ts` | accessToken 검증 방식은 변경하지 않는다. 응답 상태의 라벨/CTA 판단만 영향받는다. |
| `/admin/orders`, `app/admin/orders/page.tsx` | 상태 필터 목록이 공식 상태 기준으로 확장/정리된다. |
| `/admin/orders/[id]` | 상태 표시, 관리자 수동 변경 후보, 취소 요청 표시가 영향받는다. |
| `/admin/jobs`, `app/api/admin/jobs/[id]/status/route.ts` | 작업 상태에서 주문 상태로 동기화할 때 `preparing`, `in_service`, `cancelled`를 더 쓰지 않도록 별도 작업 계획이 필요하다. 이번 OrderStatus 계획에서는 영향 범위로만 표시한다. |
| `/admin/dashboard` | 상태별 badge, active/done/canceled 집계 기준이 영향받는다. |
| Toss confirm | `paid` 전이는 유지한다. 결제 계약은 변경하지 않는다. |
| 예약/슬롯 | `scheduled` 전이는 유지한다. `reserve_order_slot` 동작은 이번 계획에서 변경하지 않는다. |

## 9. 구현 순서 제안

실제 구현은 사용자가 "계획 승인"을 명시한 뒤에만 진행한다.

1. 공용 상태 기준 상수/타입 정리
   - `lib/types.ts`에 DB 호환 상태와 운영 상태를 구분한다.
   - 상태 목록을 상수화해 validation/label/filter가 같은 기준을 쓰게 한다.

2. 검증 schema 정리
   - `lib/validation.ts`의 주문 상태 schema를 운영 상태 중심으로 맞춘다.
   - `cancelled` alias 입력 정규화 지점을 명확히 둔다.

3. 전이표 정리
   - `lib/status.ts`에 `quoted`를 추가하고 deprecated 상태로의 전이를 제거한다.
   - 관리자 주문 상태 변경 API가 같은 전이표를 쓰는지 확인한다.

4. 라벨/필터 정리
   - `lib/format.ts`, `lib/order-status-label.ts`, `app/admin/orders/page.tsx`, `app/admin/dashboard/page.tsx`를 같은 기준으로 맞춘다.

5. 고객 상태 화면 영향 반영
   - `app/orders/[id]/order-status-client.tsx`에서 legacy alias가 CTA를 잘못 열지 않도록 확인한다.

6. DB CHECK 보정은 별도 승인 작업으로 분리
   - 최소 보정은 `quoted`를 CHECK에 추가하는 migration이다.
   - 데이터 정리 migration은 실제 row 분포 확인 후 별도 계획으로 분리한다.

## 10. QA 계획

### 10.1 정적 검증

| 검증 | 기대 결과 |
| --- | --- |
| `OrderStatus` 전체 검색 | 공식 상태 목록과 legacy alias 사용처가 문서화된 범위 안에 있어야 한다. |
| `quoted` 검색 | 견적 API, 타입, 검증, 전이, 라벨, DB CHECK 계획에 모두 반영되어야 한다. |
| `preparing`, `in_service` 검색 | 신규 주문 상태 저장 경로에서 제거 대상이 명확해야 한다. |
| `cancelled` 검색 | 주문 도메인과 작업/예약 도메인 사용이 분리되어야 한다. |

### 10.2 최소 실행 검증

계획 승인 후 구현 단계에서 최소로 실행할 검증이다.

```text
npm run typecheck
npm run build
```

DB CHECK migration을 별도 승인해 진행하는 경우에는 Supabase local 또는 검증 DB에서 migration 적용 후 주문 상태 변경 smoke test가 필요하다.

### 10.3 수동 검증 루트

| 루트/API | 시나리오 |
| --- | --- |
| `/quote/[serviceCode]` | 주문 생성 후 견적 생성 시 주문 상태가 `quoted`로 저장/표시되는지 확인 |
| `/orders/lookup` | 전화번호 조회 후 주문 상세 진입이 유지되는지 확인 |
| `/orders/[id]` | `inquiry`, `quoted`, `payment_pending`, `paid`, `scheduled`, `in_progress`, `completed`, `done`, `issue`, `warranty`, `cancel_requested`, `canceled` 라벨과 CTA가 의도대로 보이는지 확인 |
| `/admin/orders` | 공식 상태 필터가 표시되고 deprecated 상태가 기본 필터에서 빠지는지 확인 |
| `/admin/orders/[id]` | 관리자 상태 변경이 허용 전이만 통과시키는지 확인 |
| `/admin/jobs` | 작업 시작/완료/검수 후 주문 상태가 `in_progress -> completed -> done/issue`로 유지되는지 확인 |
| `/admin/dashboard` | 상태별 badge와 집계가 원문 상태 누락 없이 표시되는지 확인 |

### 10.4 API smoke 시나리오

| 단계 | API | 기대 상태 |
| --- | --- | --- |
| 주문 생성 | `POST /api/orders` | `orders.status = inquiry` |
| 견적 생성 | `POST /api/quote` | `orders.status = quoted` |
| 견적 수락 | `POST /api/quotes/:id/accept` | `orders.status = payment_pending` |
| 결제 승인 | `POST /api/payments/toss/confirm` | `orders.status = paid` |
| 예약 확정 | `POST /api/orders/:id/reservation` | `orders.status = scheduled` |
| 작업 시작 | `POST /api/admin/jobs/:id/start` 또는 기사 start | `orders.status = in_progress` |
| 작업 완료 | `POST /api/admin/jobs/:id/complete` 또는 기사 complete | `orders.status = completed` |
| 검수 통과 | `POST /api/admin/jobs/:id/inspect` | `orders.status = done` |
| 검수 실패 | `POST /api/admin/jobs/:id/inspect` | `orders.status = issue` |
| 취소 요청 | `POST /api/orders/:id/cancel` | 자동이면 `canceled`, 수동이면 `cancel_requested` |
| 취소 승인 | `POST /api/admin/cancellations/:id/approve` | `orders.status = canceled` |

### 10.5 회귀 위험 체크

| 영역 | 체크 |
| --- | --- |
| Toss 결제 | `app/api/payments/toss/confirm/route.ts`의 `paid` 전이와 amount 검증이 변하지 않아야 한다. |
| accessToken 상태조회 | `app/api/orders/[id]/status/route.ts`의 토큰 검증/마스킹 계약이 변하지 않아야 한다. |
| 예약/슬롯 | `reserve_order_slot`, `app/api/orders/[id]/reservation/route.ts`, `app/api/orders/[id]/reschedule/route.ts`의 슬롯 계산/예약 생성 방식은 변경하지 않아야 한다. |
| 관리자 작업 API | `app/api/admin/jobs/[id]/status/route.ts`의 legacy 주문 상태 동기화는 별도 작업으로 분리해야 한다. |
| 기존 데이터 | deprecated 상태 row가 화면에서 원문 그대로 노출되거나 액션을 잘못 여는지 확인해야 한다. |

## 11. 이번 계획에서 제외하는 것

- Toss confirm/webhook 계약 변경
- accessToken 기반 게스트 상태조회 인증 방식 변경
- 예약 슬롯 계산, `reserve_order_slot` 함수 변경
- 실제 DB migration 작성
- 기존 데이터 정리 SQL 작성
- package 변경
- 코드 구현

## 12. 승인 후 권장 작업 분리

1. 코드 기준 정리 작업
   - 타입, 검증, 전이, 라벨, 필터만 수정한다.

2. DB CHECK 보정 작업
   - `quoted` 누락을 포함해 DB CHECK와 enum 허용값을 맞춘다.

3. legacy 데이터 정리 작업
   - 실제 DB row 분포를 확인한 뒤 `draft`, `reservation_*`, `preparing`, `in_service`, 주문 `cancelled` 정리 여부를 결정한다.

4. 관리자 작업 상태 동기화 정리 작업
   - `app/api/admin/jobs/[id]/status/route.ts`가 쓰는 `preparing`, `in_service`, `cancelled`를 Phase 1 흐름에 맞게 분리한다.
