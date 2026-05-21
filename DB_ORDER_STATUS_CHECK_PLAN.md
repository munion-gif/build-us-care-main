# DB OrderStatus CHECK Plan

작성일: 2026-05-13

## 목적

- 축 B: 실제 DB의 `order_status` enum과 `orders_status_check`를 기준으로 `quoted`를 DB 레벨에서 허용할 수 있게 하는 최소 migration 계획을 정리한다.
- 이번 작업은 `orders.status`의 `orders_status_check` 제약만 보정한다. enum, 기존 데이터, 다른 테이블/제약은 변경하지 않는다.

## 현재 DB 정의 확인 결과

읽기 전용 SELECT로 확인한 `public.order_status` enum 값:

| 순서 | enum label |
| --- | --- |
| 1 | `draft` |
| 2 | `submitted` |
| 3 | `reservation_pending` |
| 4 | `reservation_confirmed` |
| 5 | `payment_pending` |
| 6 | `paid` |
| 7 | `preparing` |
| 8 | `in_service` |
| 9 | `completed` |
| 10 | `cancelled` |
| 11 | `inquiry` |
| 12 | `quoted` |
| 13 | `scheduled` |
| 14 | `in_progress` |
| 15 | `done` |
| 16 | `canceled` |
| 17 | `issue` |
| 18 | `warranty` |
| 19 | `cancel_requested` |

확인 결과 `quoted`는 이미 enum에 포함되어 있다. 따라서 이번 최소 migration은 enum 확장 없이 `orders_status_check`만 보정하면 된다.

현재 `orders_status_check`:

```sql
CHECK ((status = ANY (ARRAY[
  'draft'::order_status,
  'submitted'::order_status,
  'inquiry'::order_status,
  'payment_pending'::order_status,
  'paid'::order_status,
  'scheduled'::order_status,
  'reservation_confirmed'::order_status,
  'preparing'::order_status,
  'in_progress'::order_status,
  'in_service'::order_status,
  'completed'::order_status,
  'done'::order_status,
  'canceled'::order_status,
  'cancelled'::order_status,
  'cancel_requested'::order_status,
  'issue'::order_status,
  'warranty'::order_status
])))
```

현재 CHECK에는 `quoted`와 `reservation_pending`이 빠져 있다.

## quoted 추가 필요성

로컬 코드 기준 공식 운영 상태 12개:

| 공식 상태 |
| --- |
| `inquiry` |
| `quoted` |
| `payment_pending` |
| `paid` |
| `scheduled` |
| `in_progress` |
| `completed` |
| `done` |
| `issue` |
| `warranty` |
| `cancel_requested` |
| `canceled` |

`lib/status.ts` 기준 `inquiry -> quoted`가 공식 전이로 정의되어 있으므로, DB CHECK가 `quoted`를 허용하지 않으면 코드 배포 후 해당 전이가 DB constraint 오류로 실패한다.

## migration 전략

최소 변경 원칙:

- `public.order_status` enum은 변경하지 않는다.
- 기존 데이터를 UPDATE하지 않는다.
- 기존 legacy 호환 상태는 CHECK에서 계속 허용한다.
- CHECK는 공식 운영 상태 12개와 legacy 호환 상태를 모두 포함하도록 넓힌다.
- 작업/예약의 `cancelled` 정책은 이번 범위 밖이므로 건드리지 않는다.

포함할 상태:

| 구분 | 상태 |
| --- | --- |
| 공식 운영 상태 | `inquiry`, `quoted`, `payment_pending`, `paid`, `scheduled`, `in_progress`, `completed`, `done`, `issue`, `warranty`, `cancel_requested`, `canceled` |
| legacy 호환 상태 | `draft`, `submitted`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled` |

권장 순서:

1. `orders_status_check`를 DROP한다.
2. 같은 이름으로 새 CHECK를 `NOT VALID`로 ADD한다.
3. 같은 migration에서 `VALIDATE CONSTRAINT`를 실행한다.

`NOT VALID` 후 `VALIDATE CONSTRAINT`를 쓰면 신규/변경 row에는 즉시 제약이 적용되고, 기존 row 검증은 별도 단계로 수행된다. 이번 CHECK는 기존 CHECK의 superset이므로 기존 데이터 실패 가능성은 낮다.

## 확정 migration SQL

파일:

```text
supabase/migrations/202605130002_add_quoted_to_orders_status_check.sql
```

SQL:

```sql
begin;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status = any (
      array[
        'draft'::public.order_status,
        'submitted'::public.order_status,
        'reservation_pending'::public.order_status,
        'reservation_confirmed'::public.order_status,
        'inquiry'::public.order_status,
        'quoted'::public.order_status,
        'payment_pending'::public.order_status,
        'paid'::public.order_status,
        'scheduled'::public.order_status,
        'preparing'::public.order_status,
        'in_progress'::public.order_status,
        'in_service'::public.order_status,
        'completed'::public.order_status,
        'done'::public.order_status,
        'canceled'::public.order_status,
        'cancelled'::public.order_status,
        'cancel_requested'::public.order_status,
        'issue'::public.order_status,
        'warranty'::public.order_status
      ]
    )
  )
  not valid;

alter table public.orders
  validate constraint orders_status_check;

commit;
```

## 적용 환경 및 실행 결과

검증용 DB 연결 정보는 로컬 환경에 없었다. 따라서 운영 DB에 바로 적용하되, 변경 범위를 `orders_status_check` DROP/ADD/VALIDATE로 제한하고 하나의 transaction 안에서 실행했다.

적용 전 점검:

| 항목 | 결과 |
| --- | --- |
| `order_status` enum | `quoted`, `reservation_pending` 포함 |
| 기존 `orders_status_check` | `quoted`, `reservation_pending` 누락 |
| 기존 `orders.status` 실제 distinct 값 | `canceled`, `done`, `in_progress`, `inquiry`, `issue`, `paid`, `payment_pending`, `scheduled`, `submitted`, `warranty` |
| 기존 데이터 검증 위험 | 현재 distinct 값 모두 새 CHECK 허용 목록에 포함 |
| lock 위험 | `ALTER TABLE public.orders`가 짧게 lock을 잡을 수 있음 |
| 실패 시 처리 | transaction rollback |

실행 명령:

```powershell
node scripts\order-status-check-db.js check
node scripts\order-status-check-db.js apply
node scripts\order-status-check-db.js check
```

적용 결과:

| 항목 | 결과 |
| --- | --- |
| migration 적용 | 성공 |
| `VALIDATE CONSTRAINT` | 성공 |
| `orders_status_check.convalidated` | `true` |
| 최종 CHECK의 `quoted` 포함 여부 | 포함 |
| 최종 CHECK의 `reservation_pending` 포함 여부 | 포함 |
| 누락된 기대 상태 | 없음 |
| 실패 시나리오 | 없음 |

최종 재조회된 `orders_status_check`:

```sql
CHECK ((status = ANY (ARRAY[
  'draft'::order_status,
  'submitted'::order_status,
  'reservation_pending'::order_status,
  'reservation_confirmed'::order_status,
  'inquiry'::order_status,
  'quoted'::order_status,
  'payment_pending'::order_status,
  'paid'::order_status,
  'scheduled'::order_status,
  'preparing'::order_status,
  'in_progress'::order_status,
  'in_service'::order_status,
  'completed'::order_status,
  'done'::order_status,
  'canceled'::order_status,
  'cancelled'::order_status,
  'cancel_requested'::order_status,
  'issue'::order_status,
  'warranty'::order_status
])))
```

## 배포 순서 메모

DB CHECK 보정이 코드 배포보다 먼저 완료되었다. 이제 `inquiry -> quoted`를 허용하는 OrderStatus 코드를 배포해도 DB CHECK에서 `quoted`가 막히지 않는다.

## enum 확장이 필요한 경우의 예외 계획

현재 실제 DB에서는 `quoted`가 enum에 이미 포함되어 있어 필요하지 않다.

다른 환경에서 `quoted`가 enum에 없다면 CHECK 보정 전에 별도 migration으로 enum 값을 먼저 추가해야 한다.

```sql
alter type public.order_status add value if not exists 'quoted';
```

주의: PostgreSQL 환경에 따라 새 enum 값을 추가한 같은 transaction 안에서 바로 CHECK에 사용할 때 제약이 있을 수 있으므로, enum 확장과 CHECK 보정은 별도 migration으로 분리하는 것이 안전하다.

## 위험 메모

| 위험 | 내용 | 대응 |
| --- | --- | --- |
| 테이블 lock | `ALTER TABLE`은 `orders`에 lock을 건다 | 트래픽 낮은 시간에 적용 |
| 잘못된 CHECK 목록 | enum에 없는 값을 CHECK에 넣으면 migration 실패 | 적용 전 enum SELECT 재확인 |
| 기존 데이터 검증 실패 | 새 CHECK에 누락된 기존 상태가 있으면 `VALIDATE CONSTRAINT` 실패 | 공식 12개 + legacy 7개를 모두 포함 |
| 코드/DB 배포 순서 오류 | 코드가 `quoted`를 먼저 쓰면 DB CHECK에서 실패 | DB CHECK 보정 후 코드 배포 권장 |

## 롤백 메모

롤백은 새 CHECK를 DROP하고 기존 CHECK 정의로 되돌리는 방식이다. enum 값 제거는 필요하지 않으며, PostgreSQL enum value 제거는 일반적인 rollback 대상으로 삼지 않는다.

기존 CHECK로 되돌리는 SQL 초안:

```sql
begin;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status = any (
      array[
        'draft'::order_status,
        'submitted'::order_status,
        'inquiry'::order_status,
        'payment_pending'::order_status,
        'paid'::order_status,
        'scheduled'::order_status,
        'reservation_confirmed'::order_status,
        'preparing'::order_status,
        'in_progress'::order_status,
        'in_service'::order_status,
        'completed'::order_status,
        'done'::order_status,
        'canceled'::order_status,
        'cancelled'::order_status,
        'cancel_requested'::order_status,
        'issue'::order_status,
        'warranty'::order_status
      ]
    )
  )
  not valid;

alter table public.orders
  validate constraint orders_status_check;

commit;
```

## 적용 후 확인 항목

| 확인 항목 | 기대 |
| --- | --- |
| enum `order_status` | `quoted` 포함 |
| `orders_status_check` | `quoted` 포함 |
| `orders_status_check` | `reservation_pending` 포함 |
| 기존 legacy 상태 | 계속 허용 |
| 기존 데이터 | UPDATE 없이 유지 |
| `inquiry -> quoted` API | DB CHECK 오류 없이 다음 단계 검증 가능 |

## 남은 별도 작업

- 실제 migration 파일 생성 및 적용.
- 적용 후 `orders_status_check` 재조회.
- 로컬 OrderStatus 코드 Vercel 프로덕션 재배포.
- 재배포 후 상태 전이 QA 재실행.
- legacy data cleanup.
- admin jobs legacy status sync.
