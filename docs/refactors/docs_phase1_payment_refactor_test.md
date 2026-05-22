# Phase 1 결제 confirm/webhook 리팩터 테스트 시나리오

목적: Toss confirm이 수락된 최신 quote 기준으로 금액을 검증하고, 결제/웹훅 이벤트가 멱등 처리되는지 확인합니다.

## 1. 수락된 quote 없는 주문

```http
POST http://127.0.0.1:3000/api/payments/toss/confirm
Content-Type: application/json

{
  "orderId": "{quote_not_accepted_order_id}",
  "paymentKey": "mock-step3-noquote",
  "amount": 95000,
  "orderName": "no quote"
}
```

기대 결과:

```text
400 QUOTE_REQUIRED
```

## 2. 금액 불일치

```http
POST http://127.0.0.1:3000/api/payments/toss/confirm
Content-Type: application/json

{
  "orderId": "3ea5bebd-9371-4368-a919-da7c343df102",
  "paymentKey": "mock-step3-mismatch",
  "amount": 1,
  "orderName": "mismatch"
}
```

기대 결과:

```text
400 AMOUNT_MISMATCH
expected = 110000
received = 1
```

## 3. 정상 결제 승인

```http
POST http://127.0.0.1:3000/api/payments/toss/confirm
Content-Type: application/json

{
  "orderId": "3ea5bebd-9371-4368-a919-da7c343df102",
  "paymentKey": "mock-step3-normal",
  "amount": 110000,
  "orderName": "normal"
}
```

기대 결과:

- `payments.status = done`
- `payments.quote_id` 저장
- `payments.paid_at` 기록
- `payments.approved_at` 기록
- `orders.status = paid`

## 4. 동일 paymentKey 재요청

같은 요청을 다시 보냅니다.

기대 결과:

```text
200 OK
duplicate = true
```

## 5. webhook 멱등 처리

```http
POST http://127.0.0.1:3000/api/webhooks/toss
Content-Type: application/json
x-toss-event-id: evt-step3-001

{
  "eventType": "PAYMENT_STATUS_CHANGED",
  "paymentKey": "mock-step3-normal",
  "status": "DONE"
}
```

같은 이벤트를 두 번 보냅니다.

기대 결과:

- 첫 요청: `201`, `duplicate = false`
- 두 번째 요청: `200`, `duplicate = true`

## 6. DB 검증

```powershell
node scripts/apply-supabase-sql.mjs supabase/verification/phase1_payment_checks.sql
```

현재 검증 결과:

```text
payment_key = mock-step3-normal
amount = 110000
payments.status = done
provider_status = DONE
quote_id exists
accepted_quote_total = 110000
orders.status = paid
confirm event_count = 1
webhook event_count = 1
both events have payment_id
```

