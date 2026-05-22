# Phase 1 media API 리팩터 테스트 시나리오

목적: 고객 의뢰 사진과 기사 시공 사진을 기존 `order_photos`가 아니라 Phase 1 `media` 테이블에 저장하는지 확인합니다.

## 1. 고객 의뢰 사진 upload URL

```http
POST http://127.0.0.1:3000/api/orders/{orderId}/media/upload-url
Content-Type: application/json
x-admin-key: dev-admin-key

{
  "fileName": "inquiry.jpg",
  "contentType": "image/jpeg"
}
```

기대 결과:

```text
path = orders/{orderId}/inquiry/{uuid}_inquiry.jpg
type = inquiry
```

## 2. 고객 의뢰 사진 metadata 저장

```http
POST http://127.0.0.1:3000/api/orders/{orderId}/media
Content-Type: application/json

{
  "file_path": "orders/{orderId}/inquiry/manual_1.jpg",
  "accessToken": "{accessToken}"
}
```

기대 결과:

- `media.order_id = orderId`
- `media.job_id = null`
- `media.type = inquiry`
- `order_photos`에는 저장하지 않음

## 3. 기사 시공 사진 upload URL

```http
POST http://127.0.0.1:3000/api/admin/jobs/{jobId}/media/upload-url
Content-Type: application/json
x-admin-key: dev-admin-key

{
  "fileName": "job-before.jpg",
  "contentType": "image/jpeg",
  "type": "before"
}
```

기대 결과:

```text
path = jobs/{jobId}/before/{uuid}_job-before.jpg
type = before
```

## 4. 기사 시공 사진 metadata 저장

```http
POST http://127.0.0.1:3000/api/admin/jobs/{jobId}/media
Content-Type: application/json
x-admin-key: dev-admin-key

{
  "file_path": "jobs/{jobId}/after/manual_after.jpg",
  "type": "after"
}
```

기대 결과:

- `media.job_id = jobId`
- `media.order_id = null`
- `media.type = after`

## 5. sort_order 자동 증가

같은 주문에 사진 3장을 저장합니다.

기대 결과:

```text
sort_order = 1, 2, 3
```

## 6. 잘못된 owner 입력

```http
POST http://127.0.0.1:3000/api/orders/{orderId}/media
Content-Type: application/json

{
  "order_id": "{orderId}",
  "job_id": "{jobId}",
  "file_path": "orders/{orderId}/inquiry/invalid.jpg",
  "accessToken": "{accessToken}"
}
```

기대 결과:

```text
400 VALIDATION_ERROR
```

## 7. DB 검증

```powershell
node scripts/apply-supabase-sql.mjs supabase/verification/phase1_media_checks.sql
```

현재 검증 결과:

```text
order_media_count = 3
job_media_count = 1
invalid_both_owner_count = 0
invalid_missing_owner_count = 0
order media sort_order = 1, 2, 3
job media type = after
media_owner_check = exactly one of order_id/job_id
sort_order duplicate rows = 0
```
