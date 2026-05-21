# Phase 1 /api/orders 리팩터 테스트 시나리오

목적: `/api/orders`가 Phase 1 스키마 기준으로 `customers`, `homes`, `orders`를 올바르게 생성/연결하는지 확인합니다.

## 1. 주문 생성 요청

```http
POST http://127.0.0.1:3000/api/orders
Content-Type: application/json

{
  "customer": {
    "phone": "01055556666",
    "name": "Phase1 주문테스트",
    "acquisition_source": "web"
  },
  "address": {
    "road_address": "경기 수원시 영통구 테스트로 77",
    "detail_address": "707호",
    "postal_code": "16491"
  },
  "home": {
    "address_full": "경기 수원시 영통구 테스트로 77 707호",
    "address_dong": "영통동",
    "address_apt": "테스트아파트",
    "postal_code": "16491",
    "size_pyung": 24,
    "building_type": "apartment",
    "year_built": 1995,
    "housing_type": "owner"
  },
  "order": {
    "channel": "web",
    "reason": "old",
    "urgency": "within_1w",
    "self_diagnosis": "Phase 1 주문 생성 검증",
    "skus": [
      {
        "sku": "toilet_replace",
        "qty": 1,
        "service_type": "labor_service",
        "options": [],
        "material_skus": []
      }
    ]
  },
  "special_requests": "Phase 1 주문 생성 검증",
  "items": [
    {
      "service_type_code": "toilet_replace",
      "item_name": "변기 교체",
      "qty": 1,
      "unit_price": 80000,
      "options": []
    }
  ]
}
```

## 2. 기대 응답

- `ok: true`
- `data.customer.id` 존재
- `data.home.id` 존재
- `data.order.id` 존재
- `data.order.home_id = data.home.id`
- `data.order.status = inquiry`
- `data.order.order_number` 형식: `BO-YYYYMMDD-NNNN`
- `data.statusUrl` 존재

## 3. home 재사용 검증

같은 `customer.phone`과 같은 `home.address_full`로 한 번 더 주문 생성 요청을 보냅니다.

기대 결과:

- `customer_count = 1`
- `home_count = 1`
- `order_count = 2`

## 4. DB 검증 SQL

아래 파일을 실행합니다.

```powershell
node scripts/apply-supabase-sql.mjs supabase/verification/phase1_order_refactor_checks.sql
```

현재 검증 결과:

```text
customer_count = 1
home_count = 1
order_count = 2
```

즉 같은 고객/주소에서는 `homes`가 재사용되고, 새 주문만 추가되는 것을 확인했습니다.

