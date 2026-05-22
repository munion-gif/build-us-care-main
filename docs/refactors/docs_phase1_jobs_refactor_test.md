# Phase 1 jobs 운영 API 테스트 시나리오

목적: 기사 배정, 시공 시작, 완료, 검수까지 현장 운영 흐름을 `jobs`, `orders`, `inspections`, `job_status_logs`에 일관되게 기록하는지 확인합니다.

## 1. 기사 배정

```http
POST http://127.0.0.1:3000/api/admin/jobs
Content-Type: application/json
x-admin-key: dev-admin-key

{
  "order_id": "{orderId}",
  "technician_id": "{technicianId}",
  "scheduled_at": "2026-05-20T09:00:00.000Z"
}
```

기대 결과:

- `job.status = scheduled`
- `jobs.technician_id` 저장
- `jobs.scheduled_at` 저장
- `orders.status = scheduled`

## 2. 시공 시작

```http
PATCH http://127.0.0.1:3000/api/admin/jobs/{jobId}/start
x-admin-key: dev-admin-key
```

기대 결과:

- `job.status = in_progress`
- `started_at` 기록
- `orders.status = in_progress`

잘못된 상태에서 다시 호출하면:

```text
400 INVALID_STATUS
```

## 3. 시공 완료

```http
PATCH http://127.0.0.1:3000/api/admin/jobs/{jobId}/complete
x-admin-key: dev-admin-key
```

기대 결과:

- `job.status = done`
- `completed_at` 기록
- `ended_at` 기록
- `orders.status = completed`

## 4. 검수 통과

```http
PATCH http://127.0.0.1:3000/api/admin/jobs/{jobId}/inspect
Content-Type: application/json
x-admin-key: dev-admin-key

{
  "passed": true,
  "inspector_note": "검수 통과",
  "checklist_results": [{ "key": "clean", "passed": true }]
}
```

기대 결과:

- `job.status = inspected`
- `job.inspected_at` 기록
- `inspections` row 생성
- `orders.status = done`

## 5. 검수 불합격

```http
PATCH http://127.0.0.1:3000/api/admin/jobs/{jobId}/inspect
Content-Type: application/json
x-admin-key: dev-admin-key

{
  "passed": false,
  "inspector_note": "마감 보수 필요",
  "checklist_results": [{ "key": "finish", "passed": false }]
}
```

기대 결과:

- `inspections.passed = false`
- `orders.status = issue`

## 6. 목록/단건 조회

```http
GET http://127.0.0.1:3000/api/admin/jobs?order_id={orderId}&technician_id={technicianId}&status=inspected&limit=10&offset=0
x-admin-key: dev-admin-key
```

```http
GET http://127.0.0.1:3000/api/admin/jobs/{jobId}
x-admin-key: dev-admin-key
```

기대 결과:

- 목록은 `scheduled_at ASC`
- 필터: `order_id`, `technician_id`, `status`, `date_from`, `date_to`
- 페이지네이션: `limit`, `offset`
- 단건은 `technician`, `order`, `media`, `inspections`, `job_status_logs` 포함

## 7. DB 검증

```powershell
node scripts/apply-supabase-sql.mjs supabase/verification/phase1_jobs_checks.sql
```

현재 검증 결과:

```text
inspected_count = 2
started_at_count = 2
completed_at_count = 2
inspected_at_count = 2
검수 통과 inspection 1건
검수 불합격 inspection 1건
job_status enum: done, inspected 존재
order_status enum: scheduled, in_progress, done, issue 존재
```
