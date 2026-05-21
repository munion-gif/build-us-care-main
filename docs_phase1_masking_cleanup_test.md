# Phase 1 게스트 상태 조회 마스킹 + 레거시 테이블 삭제 테스트

목적: 게스트 상태 조회 응답에서 개인정보와 가격 상세를 마스킹하고, Phase 1로 대체된 MVP 레거시 테이블을 삭제해도 핵심 API가 정상 동작하는지 확인합니다.

## 1. 게스트 상태 조회

```http
GET http://127.0.0.1:3000/api/orders/{orderId}/status?accessToken={accessToken}
```

기대 결과:

```text
customer.phone = 010-****-8888
customer.name = 김**
home.address_full = 경기 수원시 영통구 테스트로 77 ***호
quotes[0] keys = accepted_at,id,quoted_at,total_final,version
```

게스트 응답에서는 quote item 단가, 결제키, access_token을 노출하지 않습니다.

## 2. 잘못된 accessToken

```http
GET http://127.0.0.1:3000/api/orders/{orderId}/status?accessToken=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

기대 결과:

```text
403 FORBIDDEN
```

## 3. 관리자 상태 조회

```http
GET http://127.0.0.1:3000/api/orders/{orderId}/status
x-admin-key: dev-admin-key
```

기대 결과:

```text
customer.phone = 01077778888
customer.name = 김영희
home.address_full = 경기 수원시 영통구 테스트로 77 1201호
```

## 4. 레거시 테이블 삭제

삭제 마이그레이션:

```powershell
node scripts/apply-supabase-sql.mjs supabase/migrations/202605070008_phase1_drop_legacy_tables.sql
```

삭제 대상:

- `order_photos`
- `reviews`
- `addresses`
- `order_items`

## 5. 삭제 후 API 검증

삭제 후에도 아래 API가 정상 동작해야 합니다.

- `POST /api/orders`
- `GET /api/orders/:id/status`
- `POST /api/orders/:id/media`
- `POST /api/orders/:id/feedback`

현재 검증 결과:

```text
mediaType = inquiry
feedbackRating = 5
```

## 6. DB 검증

```powershell
node scripts/apply-supabase-sql.mjs supabase/verification/phase1_masking_cleanup_checks.sql
```

현재 검증 결과:

```text
remaining_legacy_table_count = 0
replacement tables = feedbacks, homes, media, orders, quotes
products = still_exists
reservations = still_exists
```

`products`는 현재 코드 직접 참조는 없지만 카탈로그 정책 확정 전까지 보류했습니다. `reservations`는 예약 API와 상태 조회에서 사용 중이라 유지했습니다.
