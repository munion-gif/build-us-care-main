# Buildus Care Backend MVP

Next.js App Router + Supabase 기반의 홈서비스/시공 예약형 웹앱 백엔드 MVP입니다.

현재 목표는 정식 카탈로그 없이도 `주문 생성 -> 예약 -> 결제 mock 승인 -> 작업 상태 변경 -> 게스트 상태 조회`가 로컬에서 검증되는 골격입니다.

## 실행 방법

```bash
npm install
npm run dev
```

기본 URL은 `http://localhost:3000`입니다.

## 환경변수

`.env.example`을 참고해 `.env.local`을 만듭니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

TOSS_SECRET_KEY=
TOSS_CONFIRM_URL=https://api.tosspayments.com/v1/payments/confirm
TOSS_WEBHOOK_SECRET=
PAYMENT_MOCK_MODE=true

ADMIN_API_KEY=dev-admin-key,another-admin-key
```

- `PAYMENT_MOCK_MODE=true`: Toss 실제 키 없이 결제 승인 API를 mock 성공 처리합니다.
- `TOSS_WEBHOOK_SECRET`: real mode에서 webhook 서명 검증에 사용합니다.
- `ADMIN_API_KEY`: 운영자 API 호출 시 `x-admin-key` 헤더로 보냅니다. 쉼표로 여러 개를 넣을 수 있습니다.
- 주문 생성/조회 같은 DB API는 Supabase 연결이 필요합니다.
- `/api/health`, `/api/service-items`, `/api/quote`는 Supabase 없이도 일부 테스트 가능합니다.

## Supabase 연결

Supabase CLI를 쓰는 경우:

```bash
supabase start
supabase db reset
```

또는 Supabase Studio/SQL editor에서 아래 파일을 순서대로 실행합니다.

```text
supabase/migrations/202605060001_init_backend_mvp.sql
supabase/seed.sql
```

DB connection string이 있으면 로컬에서 바로 적용할 수도 있습니다.

```bash
set DATABASE_URL=postgresql://postgres.project-ref:password@pooler-host:6543/postgres
node scripts/apply-supabase-sql.mjs supabase/migrations/202605060001_init_backend_mvp.sql supabase/seed.sql
```

## 주요 API 테스트

### Health

```bash
curl http://localhost:3000/api/health
```

### 임시 서비스 항목

```bash
curl http://localhost:3000/api/service-items
```

### 견적 계산

```bash
curl -X POST http://localhost:3000/api/quote \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "service_type_code": "toilet_replace",
        "item_name": "변기 교체",
        "qty": 1,
        "unit_price": 80000,
        "options": [{ "name": "앵글밸브 추가", "price_delta": 15000 }]
      }
    ]
  }'
```

### 주문 생성

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": { "phone": "01011112222", "name": "홍길동" },
    "address": {
      "road_address": "경기 수원시 팔달구 테스트로 10",
      "detail_address": "101동 1001호",
      "postal_code": "16490"
    },
    "special_requests": "오전 방문 선호",
    "items": [
      {
        "service_type_code": "kitchen_faucet",
        "item_name": "주방 수전 교체",
        "qty": 1,
        "unit_price": 90000,
        "options": [{ "name": "고압호스 교체", "price_delta": 12000 }]
      }
    ]
  }'
```

응답의 `statusUrl` 또는 `order.access_token`을 게스트 상태 조회에 사용합니다.

### 사진 메타데이터 저장

```bash
curl -X POST http://localhost:3000/api/orders/{orderId}/photos \
  -H "Content-Type: application/json" \
  -d '{
    "photos": [
      { "file_path": "mock/orders/order-1/bathroom-1.jpg", "sort_order": 1 }
    ]
  }'
```

### 예약 슬롯 조회

```bash
curl "http://localhost:3000/api/reservations/slots?from=2026-05-08&days=7"
```

### 예약 연결

```bash
curl -X POST http://localhost:3000/api/orders/{orderId}/reservation \
  -H "Content-Type: application/json" \
  -d '{
    "reserved_date": "2026-05-09",
    "time_slot": "morning",
    "status": "confirmed"
  }'
```

### Toss mock 결제 승인

```bash
curl -X POST http://localhost:3000/api/payments/toss/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "{orderId}",
    "paymentKey": "mock-payment-key-001",
    "amount": 117000,
    "orderName": "주방 수전 교체"
  }'
```

### Toss webhook 저장

```bash
curl -X POST http://localhost:3000/api/webhooks/toss \
  -H "Content-Type: application/json" \
  -H "x-toss-event-id: evt-local-001" \
  -d '{
    "eventType": "PAYMENT_STATUS_CHANGED",
    "paymentKey": "mock-payment-key-001",
    "status": "DONE"
  }'
```

### 게스트 주문 상태 조회

```bash
curl "http://localhost:3000/api/orders/{orderId}/status?accessToken={accessToken}"
```

### 운영자 주문/작업 조회

```bash
curl http://localhost:3000/api/admin/orders -H "x-admin-key: dev-admin-key"
curl http://localhost:3000/api/admin/jobs -H "x-admin-key: dev-admin-key"
```

## 카탈로그 없는 현재 구조

현재 주문은 `order_items.product_id` 없이도 생성됩니다. 프론트가 보내는 임시 항목은 아래 필드로 주문에 스냅샷 저장됩니다.

- `item_name`
- `qty`
- `unit_price`
- `option_summary`
- `line_total`
- `metadata.service_type_code`

그래서 정식 SKU DB가 없어도 광고/카톡 랜딩에서 바로 주문을 만들 수 있습니다.

## 나중에 카탈로그 붙이는 방법

정식 카탈로그가 준비되면:

1. `products`, `product_options`에 SKU와 옵션 데이터를 넣습니다.
2. 프론트는 `product_id`를 포함해 `/api/quote`, `/api/orders`로 보냅니다.
3. `lib/quote.ts`에서 현재 요청 가격 신뢰 방식 대신 DB 가격 조회 방식으로 교체합니다.
4. 기존 주문은 `order_items`에 가격 스냅샷이 남아 있으므로 과거 주문 금액은 변하지 않습니다.

수정 우선 파일:

- `lib/quote.ts`
- `app/api/quote/route.ts`
- `app/api/orders/route.ts`
- `app/api/service-items/route.ts`
- `supabase/seed.sql`

자세한 설계는 `backend-spec.md`를 참고하세요.

## 보안/안정성 회귀 테스트 시나리오

수동 시나리오는 `scripts/smoke-test.http`에 정리되어 있습니다.

### 정상 플로우

| 단계 | API | 예상 |
| --- | --- | --- |
| 서비스 조회 | `GET /api/service-items` | `200`, `{ ok: true }` |
| 견적 계산 | `POST /api/quote` | `200`, 총액 반환 |
| 주문 생성 | `POST /api/orders` | `201`, `order`, `job`, `access_token` 반환 |
| 예약 | `POST /api/orders/:id/reservation` | `201`, 예약 생성 |
| 결제 mock confirm | `POST /api/payments/toss/confirm` | `200`, payment `done` |
| webhook mock | `POST /api/webhooks/toss` | `201`, event 저장 |
| 상태 조회 | `GET /api/orders/:id/status?accessToken=...` | `200`, 민감 token 제외 |
| 작업 상태 변경 | `PATCH /api/admin/jobs/:id/status` | `200`, job/order 상태 동기화 |
| 완료/후기 | `POST /api/admin/jobs/:id/report-video`, `POST /api/reviews` | `200/201` |

### 실패 플로우

| 시나리오 | 예상 |
| --- | --- |
| 잘못된 `accessToken` 조회 | `403`, `{ ok: false, error: { code: "FORBIDDEN" } }` |
| 형식이 틀린 `accessToken` 조회 | `400`, `VALIDATION_ERROR` |
| 잘못된 amount로 confirm | `400`, `BAD_REQUEST` |
| 중복 webhook event | `200`, `{ duplicate: true }` |
| real mode에서 서명 없는 webhook | `401`, `WEBHOOK_SIGNATURE_INVALID` |
| 잘못된 admin key | `401`, `UNAUTHORIZED` |

## RLS 적용

민감 테이블에는 RLS가 켜져 있습니다. 브라우저/anon key로 직접 `orders` 같은 보호 테이블을 조회해도 데이터가 노출되지 않습니다. 앱 서버는 service role key로만 Supabase에 접근하고, 게스트 조회는 Next.js API의 `access_token` 검증을 통과해야 합니다.

## 사진 업로드 테스트

주문 사진은 Supabase Storage private bucket `buildus-order-photos`에 저장합니다.

```text
bucket: buildus-order-photos
path: orders/{orderId}/original/{uuid}_{safeFileName}
```

테스트 순서:

1. Supabase에 `supabase/migrations/202605060003_order_photo_storage.sql`을 적용합니다.
2. 주문 생성 API 또는 seed/admin 조회로 `orderId`와 `accessToken`을 준비합니다.
3. 브라우저에서 `http://127.0.0.1:3004/lab/photo-upload`에 접속합니다.
4. `orderId`, `accessToken`, 이미지 파일, `sort_order`를 입력합니다.
5. `Upload Test`를 누르면 signed upload URL 발급, Storage 업로드, metadata 저장, signed view URL 조회가 순서대로 실행됩니다.

허용 파일 타입:

```text
image/jpeg
image/png
image/webp
image/heic
image/heif
```

## Lab 페이지

내부 검수용 최소 UI입니다. 모두 실제 `/api` 엔드포인트를 호출하며 `localStorage`를 사용하지 않습니다.

### Flow QA

```text
/flow
```

운영자/기획자/개발자가 한 화면에서 전체 주문 흐름을 검수하는 6단계 wizard입니다.

테스트 순서:

```text
1. 서비스 선택
2. 견적 계산
3. 주문 생성
4. 예약 생성
5. 결제 mock 승인
6. 상태 확인
```

완료 화면에서 `/lab/photo-upload`와 `/lab/admin`으로 이동할 수 있습니다.

### Order Flow

```text
/lab/order-flow
```

검증 가능 흐름:

```text
service-items 조회
quote 호출
orders 생성
reservation 생성
Toss mock confirm
guest status 조회
```

`Run 1-6` 버튼은 직전 단계의 `orderId`, `accessToken`, `amount`를 다음 단계에 자동 주입합니다. 성공 후 마지막 주문 요약에 `orderId`, `statusUrl`, 사진 업로드 이동 링크가 표시됩니다. 개별 버튼으로 단계별 호출도 가능합니다.

### Admin

```text
/lab/admin
```

검증 가능 흐름:

```text
admin key 입력
admin orders 조회
admin jobs 조회
technician assign
job status 변경
report video 등록
unauthorized 응답 확인
```

잘못된 admin key를 입력하고 조회 버튼을 누르면 `401 UNAUTHORIZED` 응답이 JSON 영역에 표시됩니다. job을 선택하면 order/job 상태 요약 카드가 갱신되고, `완료 보고 등록` 버튼은 `/api/admin/jobs/:id/report-video`를 호출한 뒤 orders/jobs를 재조회합니다.
