# Phase 1 feedback API 리팩터 테스트 시나리오

목적: 고객 후기/NPS를 기존 `reviews`가 아니라 Phase 1 `feedbacks` 테이블에 저장하는지 확인합니다.

## 1. 정상 피드백 제출

```http
POST http://127.0.0.1:3000/api/orders/{orderId}/feedback
Content-Type: application/json

{
  "accessToken": "{accessToken}",
  "rating": 5,
  "nps": 10,
  "comment": "깔끔하고 친절했습니다.",
  "categories": {
    "speed": 5,
    "kindness": 4,
    "quality": 5,
    "cleanliness": 4,
    "price": 3
  }
}
```

기대 결과:

- `feedbacks.order_id = orderId`
- `feedbacks.rating = 5`
- `feedbacks.nps = 10`
- `feedbacks.comment` 저장
- `feedbacks.categories` 5축 평점 저장
- `submitted_at` 기록

## 2. 중복 제출

같은 주문에 다시 제출합니다.

기대 결과:

```text
409 ALREADY_SUBMITTED
```

## 3. 미결제 주문 제출

`orders.status`가 `paid`, `completed`, `done`이 아닌 주문에 제출합니다.

기대 결과:

```text
400 ORDER_NOT_ELIGIBLE
```

## 4. 고객 피드백 조회

```http
GET http://127.0.0.1:3000/api/orders/{orderId}/feedback?accessToken={accessToken}
```

기대 결과:

- 피드백 조회 성공
- 잘못된 accessToken이면 `403`
- 피드백이 없으면 `404`

## 5. 관리자 목록/필터

```http
GET http://127.0.0.1:3000/api/admin/feedbacks?rating=5&nps_min=9&limit=20&offset=0
x-admin-key: dev-admin-key
```

기대 결과:

- `submitted_at DESC` 정렬
- `rating`, `nps_min`, `order_id`, `date_from`, `date_to` 필터 지원
- `limit`, `offset` 페이지네이션 지원

## 6. DB 검증

```powershell
node scripts/apply-supabase-sql.mjs supabase/verification/phase1_feedback_checks.sql
```

현재 검증 결과:

```text
feedback_count = 1
rating_count = 1
nps_count = 1
categories_count = 1
submitted_at_count = 1
duplicate_feedback_orders = 0
rating = 5
nps = 10
comment = 깔끔하고 친절했습니다.
submitted_at recorded
```
