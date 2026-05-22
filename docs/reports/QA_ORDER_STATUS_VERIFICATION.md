# QA_ORDER_STATUS_VERIFICATION

## 2026-05-13 QA 실행 검증 로그

검증 기준 URL: `https://buildus-care-flow.vercel.app/`

이번 실행에서 수행한 시나리오:

- 실제 DB에서 `김비데` 테스트 주문 조회
- Vercel 배포본에서 `/api/orders/lookup`으로 김비데 주문 조회
- Vercel 배포본에서 `/api/orders/[id]/status?accessToken=...`으로 김비데 주문 상태 조회
- Vercel 배포본에서 `/orders/lookup`, `/orders/[id]`, `/admin/orders`, `/admin/orders/[id]`, `/admin/dashboard`, `/flow` HTTP 접근 확인
- 테스트 전용 주문 6건 생성
- 테스트 전용 주문으로 관리자 주문 상태 변경 API 전이 호출
- 실제 DB의 `orders_status_check` 제약 정의 읽기

수정하지 않은 것:

- 코드 로직
- DB schema/migration
- package 파일
- 기존 김비데 주문 상태
- 기존 운영 주문 데이터

### 실행 환경 결과 요약

| 항목 | 결과 |
| --- | --- |
| 김비데 주문 | 조회됨. `BO-20260513-0001`, 현재 `scheduled`, 전화번호 `010****9876`, access token 길이 48 |
| `/api/orders/lookup` | `200 OK`, 김비데 주문 1건 반환 |
| `/api/orders/[id]/status` | `200 OK`, 김비데 주문 상태 `scheduled`, 결제 `done`, 예약 `confirmed`, 작업 `scheduled` 반환 |
| `/orders/lookup` | `200 OK`, HTML 응답 확인 |
| `/orders/[id]?accessToken=...` | `200 OK`, HTML 응답 확인 |
| `/admin/orders` | `200 OK`, HTML에 김비데 주문번호/마스킹 이름/`scheduled` 계열 표시 포함 |
| `/admin/orders/[id]` | `200 OK`, HTML에 김비데 주문번호/마스킹 이름/`scheduled` 계열 표시 포함 |
| `/admin/dashboard` | `200 OK`, HTML 응답 확인. 김비데 주문 노출 여부는 현재 대시보드 조건상 확인되지 않음 |
| `/flow` | `200 OK`, HTML 응답 확인 |
| DB CHECK | `orders_status_check` 확인. `quoted`는 포함되지 않음 |

### 배포본 상태 주의

Vercel 배포본은 로컬 코드 기준 정리 결과와 일부 다르게 동작한다.

| 검증 | 기대 | Vercel 실제 | 판정 |
| --- | --- | --- | --- |
| `inquiry -> quoted` | 허용 | `400 VALIDATION_ERROR` | 주의 |
| `inquiry -> payment_pending` | 차단 | `200 OK`, `payment_pending`으로 변경됨 | 주의 |
| `completed -> warranty` | 차단 | `200 OK`, `warranty`로 변경됨 | 주의 |
| `scheduled -> done` | 차단 | `409 CONFLICT` | 통과 |
| `canceled -> paid` | 차단 | `409 CONFLICT` | 통과 |
| 고객 A/S API on `completed` | 차단 | `400 ORDER_NOT_COMPLETED` | 통과 |

해석:

- 배포본의 `app/api/admin/orders/[id]/status/route.ts` 및 검증 schema가 현재 로컬 구현과 일치하지 않는 것으로 보인다.
- DB CHECK도 `quoted`를 허용하지 않기 때문에, 배포본/DB 기준으로는 `quoted` 공식 운영 상태 전환이 아직 운영 가능하지 않다.
- 이번 단계는 QA 문서화가 목적이므로 수정하지 않고 주의 항목으로 기록한다.

### 테스트 전용 주문 실행 결과

| 주문번호 | 용도 | 주요 호출 | 최종 확인 상태 |
| --- | --- | --- | --- |
| `BO-20260513-0002` | `inquiry -> quoted` 확인 | `PATCH /api/admin/orders/:id/status {"status":"quoted"}` -> `400 VALIDATION_ERROR` | `inquiry`로 생성 후 quoted 전환 실패 |
| `BO-20260513-0003` | 정상 흐름 일부 확인 | admin order PATCH로 `payment_pending` seed 후 `paid -> scheduled -> in_progress -> completed -> done -> warranty` | `warranty` |
| `BO-20260513-0004` | `completed -> warranty` 차단 확인 | admin order PATCH로 `completed` seed 후 status API `warranty` 호출 -> `200 OK` | `warranty`, 기대와 달라 주의 |
| `BO-20260513-0005` | `inquiry -> payment_pending` 차단 확인 | status API `payment_pending` 호출 -> `200 OK` | `payment_pending`, 기대와 달라 주의 |
| `BO-20260513-0006` | `scheduled -> done` 차단 확인 | admin order PATCH로 `scheduled` seed 후 status API `done` 호출 -> `409 CONFLICT` | `scheduled` |
| `BO-20260513-0007` | `canceled` terminal 확인 | `inquiry -> canceled` 성공 후 `canceled -> paid` 호출 -> `409 CONFLICT` | `canceled` |

주의:

- 테스트 주문은 QA 검증 목적으로만 생성했다.
- 원상 복구는 수행하지 않았다.
- 상태 seed가 필요한 케이스는 `PATCH /api/admin/orders/:id`를 사용했으며, 전이 차단/허용 확인은 `PATCH /api/admin/orders/:id/status`를 사용했다.

## 1. 검증 범위

검증 단계에서 수행한 작업:

- OrderStatus 기준 정리 코드의 정적 검증
- 주요 라우트/화면 빌드 생성 여부 확인
- 사람이 이어서 브라우저에서 확인할 수 있는 수동 QA 절차 작성

수정하지 않은 것:

- 코드 로직
- DB migration
- package 파일
- DB row 또는 샘플 주문 상태

참고 문서:

- `README.md`
- `backend-spec.md`
- `PROJECT_ARCHITECTURE_OVERVIEW.md`
- `STATUS_CONSISTENCY_AUDIT.md`
- `IMPLEMENTATION_PLAN_ORDER_STATUS.md`
- `docs/order-status-mapping.md`

검증 명령:

| 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |

`npm run build`에서 `/orders/lookup`, `/orders/[id]`, `/admin/orders`, `/admin/orders/[id]`, `/admin/dashboard`, `/flow` 라우트가 생성되는 것을 확인했다.

## 2. 공식 운영 상태 최종 목록

`lib/types.ts`의 `OPERATIONAL_ORDER_STATUSES` 기준 공식 운영 상태는 아래 12개다.

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

검증 결과: 통과

## 3. Alias/Deprecated 처리 정책

| 상태 | 기대 정책 | 코드 기준 확인 결과 |
| --- | --- | --- |
| `submitted` | `inquiry` 계열 표시, 신규 입력 금지 | `lib/order-status-label.ts`, `app/orders/[id]/order-status-client.tsx`, `components/orders/OrderCurrentStatusPanel.tsx`, `app/flow/page.tsx`에서 `inquiry` 계열 처리 확인 |
| `draft` | `inquiry` 계열 표시, 신규 입력 금지 | 고객 상태 UI/현재 상태 패널에서 `inquiry` 계열 처리 확인 |
| `reservation_pending` | `payment_pending` 계열 표시, 신규 입력 금지 | 고객 상태 UI/현재 상태 패널에서 `payment_pending` 계열 처리 확인 |
| `reservation_confirmed` | `scheduled` 계열 표시, 신규 입력 금지 | 고객 상태 UI/현재 상태 패널에서 `scheduled` 계열 처리 확인 |
| `preparing` | `scheduled` 계열 표시, 신규 입력 금지 | 고객 상태 UI/현재 상태 패널에서 `scheduled` 계열 처리 확인 |
| `in_service` | `in_progress` 계열 표시, 신규 입력 금지 | 고객 상태 UI/현재 상태 패널에서 `in_progress` 계열 처리 확인 |
| 주문 `cancelled` | 입력은 `canceled`로 정규화, UI는 취소 계열 표시 | `lib/types.ts`의 `normalizeOrderStatusAlias()`, `lib/validation.ts`의 `orderStatusInputSchema`, 고객 라벨/상태 UI에서 확인 |
| 작업/예약 `cancelled` | 이번 범위 밖. 유지 | `JobStatus`, `ReservationStatus`, 작업/예약 필터에서 유지 확인 |

검증 결과: 통과

주의:

- `lib/status.ts`에는 legacy 현재 상태에서 공식 상태로 복구/이동하는 전이가 남아 있다. 예: `submitted -> quoted/canceled`, `draft -> inquiry/canceled`. 신규 입력은 막혀 있으나, 기존 DB row가 legacy 상태인 경우 관리자 상태 변경 API를 통해 공식 상태로 이동할 수 있다.
- 현재 DB row가 주문 `cancelled`인 경우 `ORDER_TRANSITIONS.cancelled`는 빈 배열이다. UI 표시는 취소 계열로 동작하지만, 관리자 상태 변경 API에서 `cancelled -> canceled` 전환은 별도 legacy data cleanup 전까지 자동 보정되지 않는다.

## 4. 코드 기준 검증 결과

| 파일 | 확인 항목 | 결과 |
| --- | --- | --- |
| `lib/types.ts` | 공식 운영 상태 12개, legacy 상태 분리, `cancelled -> canceled` 정규화 함수 | 통과 |
| `lib/validation.ts` | `orderStatusInputSchema`가 `OPERATIONAL_ORDER_STATUSES`를 기준으로 검증하고 `cancelled` 입력을 정규화 | 통과 |
| `lib/status.ts` | `ORDER_TRANSITIONS`가 공식 상태 중심으로 정리됨 | 통과 |
| `lib/format.ts` | 관리자/공통 라벨에 공식 상태와 alias 상태 라벨 반영 | 통과 |
| `lib/order-status-label.ts` | 고객 라벨과 타임라인에서 alias 상태를 공식 계열로 정규화 | 통과 |
| `app/api/admin/orders/[id]/status/route.ts` | `orderStatusPatchSchema`와 `canTransitionOrder()` 사용, 실패 시 허용 상태 표시 | 통과 |
| `app/api/admin/orders/[id]/route.ts` | 주문 상태 patch에 `orderStatusInputSchema` 사용 | 통과 |
| `app/admin/orders/page.tsx` | 관리자 필터가 `OPERATIONAL_ORDER_STATUSES` 기반 | 통과 |
| `app/admin/dashboard/page.tsx` | `quoted`, `payment_pending`, `cancel_requested` badge 분기 반영 | 통과 |
| `app/orders/[id]/order-status-client.tsx` | 고객 상태 화면 alias 정규화, A/S 섹션 `done` 기준 | 통과 |
| `components/orders/NextActionCard.tsx` | A/S primary action이 `done`에서만 열림 | 통과 |
| `components/orders/OrderCurrentStatusPanel.tsx` | `quoted`, `payment_pending`, alias 상태 안내 문구 반영 | 통과 |
| `app/flow/page.tsx` | 내부 QA 화면 상태 라벨에 공식/alias 상태 반영 | 통과 |

## 5. 상태 전이 검증 결과

| 검증 항목 | 실제 코드 기준 | 결과 |
| --- | --- | --- |
| `inquiry` 다음 허용 상태에 `payment_pending`이 없어야 함 | `lib/status.ts`: `inquiry: ["quoted", "canceled"]` | 통과 |
| `completed` 다음 허용 상태에 `warranty`가 없어야 함 | `lib/status.ts`: `completed: ["done", "issue"]` | 통과 |
| `done`에서만 warranty/A/S 계열 CTA가 열려야 함 | `components/orders/NextActionCard.tsx`: `orderStatus === "done"`에서 A/S primary action. `app/orders/[id]/order-status-client.tsx`: A/S 섹션도 `orderStatus === "done"` 조건 | 통과 |
| `canceled`가 주문 최종 취소 기준값이어야 함 | `lib/status.ts`: `canceled: []`, `lib/validation.ts`: 주문 `cancelled` 입력은 `canceled`로 정규화 | 통과 |
| 주문 입력 `cancelled`가 `canceled`로 정규화되어야 함 | `lib/types.ts` `normalizeOrderStatusAlias()`, `lib/validation.ts` `orderStatusInputSchema` | 통과 |

주의:

- `warranty` 상태의 관리자 전이에는 `scheduled`, `in_progress`, `done`이 허용되어 있다. 이번 조건은 `completed -> warranty` 금지와 고객 A/S CTA `done` 기준 유지였으므로 직접 충돌은 아니다.
- 고객 피드백 CTA는 `done`, `completed`에서 열린다. 이번 검증 조건은 A/S CTA 기준이므로 피드백 CTA는 범위 밖으로 본다.

## 6. UI/라벨 검증 결과

| 정책 | 확인 파일 | 결과 |
| --- | --- | --- |
| `submitted`, `draft -> inquiry` 계열 라벨 | `lib/order-status-label.ts`, `components/orders/OrderCurrentStatusPanel.tsx`, `app/orders/[id]/order-status-client.tsx`, `app/flow/page.tsx` | 통과 |
| `reservation_pending -> payment_pending` 계열 라벨 | `lib/order-status-label.ts`, `components/orders/OrderCurrentStatusPanel.tsx`, `app/orders/[id]/order-status-client.tsx`, `app/flow/page.tsx` | 통과 |
| `reservation_confirmed`, `preparing -> scheduled` 계열 라벨 | `lib/order-status-label.ts`, `components/orders/OrderCurrentStatusPanel.tsx`, `app/orders/[id]/order-status-client.tsx`, `app/flow/page.tsx` | 통과 |
| `in_service -> in_progress` 계열 라벨 | `lib/order-status-label.ts`, `components/orders/OrderCurrentStatusPanel.tsx`, `app/orders/[id]/order-status-client.tsx`, `app/flow/page.tsx` | 통과 |
| 주문 `cancelled -> canceled` 계열 라벨 | `lib/order-status-label.ts`, `lib/format.ts`, `components/orders/OrderCurrentStatusPanel.tsx`, `app/orders/[id]/order-status-client.tsx` | 통과 |
| 관리자 필터가 공식 운영 상태 12개 기준인지 | `app/admin/orders/page.tsx`에서 `const statuses = ["", ...OPERATIONAL_ORDER_STATUSES]` 확인 | 통과 |

미확인:

- 실제 브라우저에서 각 alias 상태 row가 표시되는 화면은 확인하지 않았다. 현재 DB row 상태를 변경하지 않는 조건 때문에 코드 기준으로만 검증했다.

## 7. 김비데 주문 기준 수동 확인 절차

샘플 데이터 조건:

- 사용자가 `김비데` 이름으로 테스트 주문 1건을 생성해 둔 상태
- 김비데 주문은 조회 전용으로 사용했고 상태를 변경하지 않았다.
- 상태 전이 검증은 별도 QA 테스트 주문을 생성해 수행했다.
- 아래 절차는 사람이 브라우저에서 이어서 확인할 수 있는 절차와 이번 실행 결과를 함께 남긴다.

### 7.1 `/orders/lookup`

1. 브라우저에서 `/orders/lookup` 접속
2. 김비데 주문 생성 시 사용한 전화번호 입력
3. 조회 결과에 김비데 주문이 나타나는지 확인
4. 표시 상태가 원문 상태값이 아니라 고객 친화 라벨로 보이는지 확인
5. 주문 상세 진입 링크가 있으면 클릭해 `/orders/[id]`로 이동

기대:

- `submitted`/`draft` 계열이면 문의 접수 계열 안내
- `reservation_pending`이면 결제 대기 계열 안내
- `reservation_confirmed`/`preparing`이면 방문 확정 계열 안내
- `in_service`이면 시공 중 계열 안내
- `cancelled`이면 취소 계열 안내

상태: 부분 통과

실행 결과:

- `/api/orders/lookup`에 `김비데`와 마스킹된 전화번호 원문을 사용해 호출했고 `200 OK`를 받았다.
- 응답에는 `BO-20260513-0001`, `status = scheduled`, `reservation.status = confirmed`, `jobStatus = scheduled`, `paymentStatus = done`이 포함됐다.
- 실제 브라우저 UI에서 form 입력/클릭은 수행하지 못했다.

### 7.2 `/orders/[id]` 또는 accessToken 기반 주문 상태 화면

1. 김비데 주문의 `statusUrl` 또는 `/orders/[id]?accessToken=...` 형식의 상태 화면 접속
2. 현재 상태 카드의 라벨 확인
3. 진행 타임라인 라벨 확인
4. 주문 상태가 `done`일 때만 A/S 섹션이 표시되는지 확인
5. 주문 상태가 `completed`라면 A/S 섹션이 표시되지 않고 검수 중/검수 대기 계열 안내가 보이는지 확인
6. 주문 상태가 `cancel_requested`라면 취소 요청 처리 중 안내가 보이는지 확인
7. 주문 상태가 `canceled` 또는 legacy `cancelled`라면 주문 취소 안내가 보이는지 확인

상태: 부분 통과

실행 결과:

- `/api/orders/[id]/status?accessToken=...` 호출은 `200 OK`였다.
- 응답 기준 김비데 주문은 `orders.status = scheduled`, `jobs.status = scheduled`, `reservations.status = confirmed`, `payments.status = done`이다.
- `/orders/[id]?accessToken=...` HTML 접근은 `200 OK`였다.
- 실제 hydration 후 CTA 노출을 눈으로 클릭 확인하지는 못했다.

### 7.3 `/admin/orders`

1. 관리자 로그인 후 `/admin/orders` 접속
2. 상태 필터 목록 확인
3. 필터에 공식 운영 상태 12개가 표시되는지 확인
4. 기본 필터에 `submitted`, `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled`가 없는지 확인
5. 김비데 주문 row를 찾는다.
   - 현재 화면 검색은 주문번호/전화번호 중심이다.
   - 이름 검색이 필요한 경우 직접 검색이 제한될 수 있으므로 주문번호 또는 전화번호를 사용한다.
6. 김비데 주문 상태 badge 라벨이 정책대로 보이는지 확인

상태: 부분 통과

실행 결과:

- 관리자 세션 쿠키로 `/admin/orders` HTML 접근은 `200 OK`였다.
- HTML에는 `BO-20260513-0001`, 마스킹 이름, `scheduled` 계열 표시가 포함됐다.
- 필터 dropdown의 12개 옵션을 실제 브라우저 UI에서 눈으로 확인하지는 못했다.

### 7.4 `/admin/orders/[id]`

1. `/admin/orders`에서 김비데 주문 상세로 진입
2. 상단 상태 badge가 `formatOrderStatus()` 기준 라벨로 보이는지 확인
3. 운영 수정 패널에서 상태 변경이 필요한 경우, 공식 운영 상태만 입력/전송되는지 확인
4. 관리자 주문 상태 변경 API를 사용하는 UI 또는 도구가 있다면 아래 전이를 확인
   - `inquiry -> quoted`: 가능해야 함
   - `inquiry -> payment_pending`: 막혀야 함
   - `completed -> done`: 가능해야 함
   - `completed -> warranty`: 막혀야 함
   - `cancelled` 입력 시 `canceled`로 정규화되어야 함

주의:

- 이 단계에서 DB 상태를 바꾸면 QA 데이터가 변경된다. 실제 전이 API를 호출할 경우 별도 승인된 테스트 주문으로만 수행한다.

상태: 부분 통과

실행 결과:

- 관리자 세션 쿠키로 `/admin/orders/7bbf5157-49b6-4aab-bb3b-28d885c9db20` HTML 접근은 `200 OK`였다.
- HTML에는 `BO-20260513-0001`, 마스킹 이름, `scheduled` 계열 표시가 포함됐다.
- 관리자 화면에서 직접 CTA를 클릭하지는 않았다.
- 전이 API는 별도 QA 테스트 주문으로 수행했다.

### 7.5 `/admin/dashboard`

1. `/admin/dashboard` 접속
2. 최근 주문, 미배정 paid 주문, 오늘/내일 방문 일정의 badge 라벨 확인
3. `quoted`, `payment_pending`, `paid`가 blue 계열 badge로 표시되는지 확인
4. `cancel_requested`가 orange 계열 badge로 표시되는지 확인
5. 작업/예약 `cancelled`는 여전히 작업/예약 도메인 취소로 취급되는지 확인

상태: 부분 확인

실행 결과:

- 관리자 세션 쿠키로 `/admin/dashboard` HTML 접근은 `200 OK`였다.
- 김비데 주문이 최근 주문/미배정/오늘·내일 방문 블록에 노출되는지는 HTML 검색으로 확인되지 않았다.

### 7.6 `/flow`

1. `/flow` 접속
2. QA flow에서 상태 라벨 표시 영역 확인
3. `submitted`, `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled` 라벨이 정책대로 표시되는지 확인

상태: 부분 확인

실행 결과:

- `/flow` HTML 접근은 `200 OK`였다.
- alias 라벨 표시를 실제 화면 조작으로 확인하지는 못했다.

### 7.7 실행 결과 표

| 화면/API | 기대 | 실제 | 판정 |
| --- | --- | --- | --- |
| `/api/orders/lookup` | 김비데 주문 조회 | `200 OK`, `BO-20260513-0001`, `scheduled` 반환 | 통과 |
| `/orders/lookup` | 조회 화면 접근 | `200 OK`, HTML 응답 | 부분 통과 |
| `/api/orders/[id]/status` | accessToken 상태 조회 | `200 OK`, `scheduled`/`confirmed`/`scheduled`/`done` 반환 | 통과 |
| `/orders/[id]?accessToken=...` | 고객 상태 화면 접근 | `200 OK`, HTML 응답 | 부분 통과 |
| `/admin/orders` | 관리자 목록 접근 및 김비데 row 표시 | `200 OK`, HTML에 주문번호/마스킹 이름/`scheduled` 포함 | 부분 통과 |
| `/admin/orders/[id]` | 관리자 상세 접근 및 상태 표시 | `200 OK`, HTML에 주문번호/마스킹 이름/`scheduled` 포함 | 부분 통과 |
| `/admin/dashboard` | 대시보드 접근 | `200 OK`, 김비데 주문 직접 노출은 미확인 | 부분 확인 |
| `/flow` | QA flow 접근 | `200 OK`, alias 라벨 조작 확인은 미수행 | 부분 확인 |

## 8. 통과 항목

### 8.1 로컬 코드/빌드 기준 통과

- 공식 운영 상태 12개가 `lib/types.ts`에 반영되어 있다.
- 관리자 필터가 `OPERATIONAL_ORDER_STATUSES`를 기준으로 동작한다.
- 주문 상태 입력 검증은 공식 운영 상태 subset을 기준으로 한다.
- 주문 `cancelled` 입력은 `canceled`로 정규화된다.
- `inquiry -> payment_pending` 전이는 허용되지 않는다.
- `completed -> warranty` 전이는 허용되지 않는다.
- 고객 A/S CTA는 `done` 기준으로 제한되어 있다.
- `npm run typecheck` 통과.
- `npm run build` 통과.

### 8.2 Vercel/실제 DB 실행 기준 통과

- 김비데 주문은 실제 DB에서 조회됐다.
- `/api/orders/lookup`은 김비데 주문 1건을 반환했다.
- `/api/orders/[id]/status`는 김비데 주문의 현재 상태 `scheduled`, 결제 `done`, 예약 `confirmed`, 작업 `scheduled`를 반환했다.
- `/orders/lookup`, `/orders/[id]`, `/admin/orders`, `/admin/orders/[id]`, `/admin/dashboard`, `/flow`는 모두 `200 OK`로 접근됐다.
- `/admin/orders`와 `/admin/orders/[id]` HTML에는 김비데 주문번호와 마스킹된 이름, `scheduled` 계열 표시가 포함됐다.
- 테스트 주문 기준 `scheduled -> done` 직접 전이는 `409 CONFLICT`로 차단됐다.
- 테스트 주문 기준 `canceled -> paid` 전이는 `409 CONFLICT`로 차단됐다.
- 테스트 주문 기준 `completed` 상태에서 고객 A/S API 호출은 `400 ORDER_NOT_COMPLETED`로 차단됐다.

## 9. 주의 항목

- 실제 DB CHECK에는 아직 `quoted` 보정이 반영되지 않았다. 확인된 제약은 `orders_status_check`이며, `quoted`가 목록에 없다.
- legacy DB row가 `cancelled` 주문 상태인 경우, UI 표시는 취소 계열로 처리되지만 관리자 상태 변경 API에서 `cancelled -> canceled` 정리는 별도 data cleanup 전까지 자동으로 처리되지 않는다.
- `app/api/admin/jobs/[id]/status/route.ts`는 이번 범위 밖이라 작업 상태에서 주문 상태로 `preparing`, `in_service`, `cancelled`를 동기화하는 legacy 로직이 남아 있다.
- Vercel 배포본은 로컬 코드 기준 정리 결과와 다르게 동작한다.
  - `inquiry -> quoted`는 기대상 허용이어야 하나, 배포본은 `400 VALIDATION_ERROR`로 거부했다.
  - `inquiry -> payment_pending`은 기대상 차단되어야 하나, 배포본은 `200 OK`로 허용했다.
  - `completed -> warranty`는 기대상 차단되어야 하나, 배포본은 `200 OK`로 허용했다.
- 따라서 현재 Vercel URL 기준 운영 검증은 “로컬 구현이 배포에 반영되지 않았거나 배포본이 다른 코드 기준으로 동작한다”는 주의 결론이다.
- `/admin/dashboard`는 접근은 됐지만 김비데 주문이 최근 주문/집계에 직접 노출되는지는 확인되지 않았다.

### 9.1 DB CHECK 실행 확인

읽기 전용 쿼리로 확인한 `public.orders` 상태 제약:

```text
orders_status_check:
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

확인 결과:

- `quoted`는 포함되어 있지 않다.
- `draft`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled`는 포함되어 있다.
- `reservation_pending`은 포함되어 있지 않다.
- `payment_pending`은 포함되어 있다.

## 10. 미확인 항목

- 실제 브라우저에서 JavaScript hydration 후 고객 화면 CTA를 눈으로 클릭 확인한 결과
- `/admin/orders` 상태 필터 dropdown의 12개 옵션 전체를 브라우저 UI에서 눈으로 확인한 결과
- `/admin/dashboard`에서 김비데 주문이 집계/최근 주문에 보이는지 여부
- `/flow`에서 alias 상태 라벨을 화면 조작으로 직접 확인한 결과

## 11. 남은 별도 작업

1. DB CHECK 보정
   - 실제 DB에서 확인된 제약 이름은 `orders_status_check`다.
   - 현재 CHECK 목록에는 `quoted`가 없다.
   - `quoted`를 포함하도록 별도 migration 계획/승인이 필요하다.

2. Legacy data cleanup
   - 기존 `orders.status`의 `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, 주문 `cancelled` row 분포 확인
   - 정리 mapping 확정 후 별도 migration 또는 운영 스크립트 계획

3. Admin jobs legacy status sync
   - `app/api/admin/jobs/[id]/status/route.ts`의 `preparing`, `in_service`, `cancelled` 주문 동기화 로직 정리
   - 전용 작업 API의 `scheduled -> in_progress -> done -> inspected` 흐름과 범용 작업 상태 변경 API의 역할 재정의

## 12. 운영자 수동 검증 가능 여부

현재 상태로 운영자는 수동 검증을 진행할 수 있다. 다만 Vercel 배포본이 로컬 코드 기준과 다르게 동작하므로, 상태 전이 검증은 “현재 배포본의 실제 동작 확인”으로만 해석해야 한다.

필요한 준비값:

- 김비데 주문 전화번호: `010****9876`
- 김비데 주문번호: `BO-20260513-0001`
- 김비데 주문 현재 상태: `scheduled`
- 고객 상태 조회용 `accessToken` 또는 `statusUrl` 원문은 문서에 남기지 않는다. 필요 시 DB 또는 `/api/orders/lookup` 응답에서 운영자가 직접 확인한다.
- 관리자 로그인 세션 또는 관리자 접근 권한

## 13. 다음 우선 작업

가장 우선할 작업은 배포본과 로컬 코드 기준의 차이를 해소하는 것이다.

1. Vercel 배포본이 현재 로컬 OrderStatus 정리 코드를 포함하는지 확인한다.
2. 배포가 최신이라면 `app/api/admin/orders/[id]/status/route.ts`와 validation schema가 왜 로컬과 다르게 동작하는지 원인을 좁힌다.
3. 그 다음 DB CHECK 보정을 진행한다. 실제 DB의 `orders_status_check`에는 `quoted`가 없으므로, `quoted` 공식 상태를 운영하려면 별도 migration이 필요하다.
4. 이후 legacy data cleanup과 admin jobs legacy status sync를 별도 작업으로 진행한다.

## 14. 배포 후 재검증

검증일: 2026-05-13

배포 기준:

| 항목 | 값 |
| --- | --- |
| 로컬 브랜치 | `master` |
| Git commit | 없음. `git rev-parse HEAD` 실패 |
| 배포 기준 | 현재 로컬 워크스페이스 파일 트리 |
| Vercel project | `buildus-care-flow` |
| production deployment id | `dpl_4f1fDXsBLDQg9pxNaZUuELRYSoRD` |
| deployment URL | `buildus-care-flow-mk3su65mv-juns-projects-58815d6e.vercel.app` |
| production alias | `https://buildus-care-flow.vercel.app` |
| createdAt | 2026-05-13 15:08:01 KST |
| 배포 명령 | `vercel --prod` |

사전 검증:

| 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `vercel inspect https://buildus-care-flow.vercel.app --json` | `READY`, production alias 연결 확인 |

검증 방식:

- `scripts/qa-order-status-production.js`로 운영 DB에 QA 주문을 생성했다.
- production API `PATCH /api/admin/orders/:id/status`를 실제 호출했다.
- 고객 상태 API `GET /api/orders/:id/status`를 실제 호출했다.
- 고객 주문 화면은 Chrome headless `--dump-dom`으로 실제 `/orders/:id?accessToken=...` 페이지 DOM을 렌더링해 CTA 텍스트를 확인했다.
- QA 주문은 검증 종료 후 삭제했고, `special_requests = 'QA_ORDER_STATUS_PRODUCTION'` 잔여 주문 count는 `0`이다.

전이 API 재검증 결과:

| 시나리오 | 기대 | 실제 | 결과 |
| --- | --- | --- | --- |
| `inquiry -> quoted` | 허용 | `200 OK`, 최종 `quoted` | 통과 |
| `quoted -> payment_pending` | 허용 | `200 OK`, 최종 `payment_pending` | 통과 |
| `inquiry -> payment_pending` | 차단 | `409 CONFLICT`, 최종 `inquiry` 유지 | 통과 |
| `completed -> warranty` | 차단 | `409 CONFLICT`, 최종 `completed` 유지 | 통과 |
| `done -> warranty` | 허용 | `200 OK`, 최종 `warranty` | 통과 |
| `scheduled -> done` | 차단 | `409 CONFLICT`, 최종 `scheduled` 유지 | 통과 |
| `canceled -> paid` | 차단 | `409 CONFLICT`, 최종 `canceled` 유지 | 통과 |

고객 화면/API 재검증 결과:

| 시나리오 | 기대 | 실제 | 결과 |
| --- | --- | --- | --- |
| completed 상태 고객 상태 API | 조회 가능 | `200 OK`, status `completed` | 통과 |
| completed 상태 고객 화면 | A/S CTA 미노출 | rendered DOM에서 A/S CTA 없음 | 통과 |
| completed 상태 A/S 요청 API | 요청 불가 | `400 ORDER_NOT_COMPLETED` | 통과 |
| done 상태 고객 상태 API | 조회 가능 | `200 OK`, status `done` | 통과 |
| done 상태 고객 화면 | A/S CTA 노출 | rendered DOM에서 `A/S가 필요하신가요?`, `A/S 신고하기` 확인 | 통과 |
| done 상태 A/S 요청 API | 요청 가능 | `201 Created`, 주문 status `warranty` 전환 | 통과 |

남은 예외/리스크:

- 로컬 저장소에는 여전히 Git commit `HEAD`가 없어 배포 기준을 commit SHA로 고정하지 못했다.
- Vercel deployment inspect 결과에도 Git source가 없어 배포 소스 추적성은 “현재 워크스페이스 직접 배포” 수준이다.
- Chrome headless DOM 검증은 CTA 렌더링 확인까지 수행했다. 모달 클릭 후 제출 버튼의 시각 상태는 API `201 Created`로 대체 검증했다.
- jobs/기사 legacy status sync는 이번 범위에서 제외했다.
