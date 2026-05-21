# Phase 1 /api/quote 리팩터 테스트 시나리오

목적: `/api/quote`가 `quotes` 테이블에 버전 견적을 저장하고, `/api/quotes/:id/accept`가 수락 상태를 올바르게 기록하는지 확인합니다.

## 1. 견적 생성

```http
POST http://127.0.0.1:3000/api/quote
Content-Type: application/json

{
  "order_id": "3ea5bebd-9371-4368-a919-da7c343df102",
  "items": [
    {
      "service_type_code": "toilet_replace",
      "item_name": "변기 교체",
      "qty": 1,
      "unit_price": 1,
      "options": [
        { "name": "앵글밸브 추가", "price_delta": 15000 }
      ]
    }
  ],
  "discount": 0
}
```

## 2. 기대 결과

- `quotes.version`이 주문별로 `1, 2, ...` 증가
- `service_items.base_price` 기준으로 시공비 계산
- 프론트가 보낸 `unit_price`는 금액 계산에 사용하지 않음
- `metadata.client_unit_price_ignored`에 프론트 입력 단가만 기록
- 출장비는 `visit_fee` 1회만 반영

현재 검증 결과:

```text
quote_count = 2
first_version = 1
latest_version = 2
accepted_count = 1
```

## 3. 견적 수락

```http
POST http://127.0.0.1:3000/api/quotes/{quoteId}/accept
```

기대 결과:

- 최초 수락: `200 OK`
- `accepted_at` 기록
- 같은 quote 재수락: `409 Conflict`

## 4. DB 검증 SQL

```powershell
node scripts/apply-supabase-sql.mjs supabase/verification/phase1_quote_checks.sql
```

확인 항목:

- `version` 증가
- `accepted_at` 기록
- `accepted_count = 1`

