# Buildus Care Phase 1 마이그레이션 Runbook

작성일: 2026-05-07  
목적: Phase 1 스키마를 테스트 DB에 안전하게 적용하고 검증하는 실행 절차

## 1. 현재 상태

Phase 1 설계와 마이그레이션 분리는 완료되었습니다.

적용 대상 파일:

```text
supabase/migrations/202605070001_phase1_foundation.sql
supabase/migrations/202605070002_phase1_existing_table_expansion.sql
supabase/migrations/202605070003_phase1_data_backfill.sql
supabase/migrations/202605070004_phase1_indexes_rls.sql
```

검증 파일:

```text
supabase/verification/phase1_backfill_checks.sql
```

## 2. 적용 전 확인

먼저 적용 대상 DB가 테스트 DB인지 확인합니다.

현재 로컬 `.env.local`에는 DB 직접 연결 정보가 없으므로, 마이그레이션 실행 전 아래 값이 필요합니다.

권장:

```text
MIGRATION_DATABASE_URL=postgresql://...
```

대체:

```text
DATABASE_URL=postgresql://...
```

또는 Supabase pooler 탐색용:

```text
SUPABASE_PROJECT_REF=...
SUPABASE_DB_PASSWORD=...
```

주의:

- 운영 DB에 바로 적용하지 않습니다.
- 테스트 DB에서 먼저 reset/replay를 확인합니다.
- 가능하면 앱 런타임용 `DATABASE_URL`과 마이그레이션용 `MIGRATION_DATABASE_URL`을 분리합니다.
- DDL 마이그레이션은 가능하면 Supabase direct connection string을 사용합니다.
- 기존 MVP API가 아직 기존 상태값을 사용하므로, 주문 상태값 UPDATE는 아직 실행하지 않습니다.

## 3. 적용 DB 확인

`scripts/apply-supabase-sql.mjs`는 실행 시 아래 정보를 먼저 출력합니다.

```text
database_name
user_name
server_addr
server_port
```

마이그레이션 적용 전에 이 출력이 테스트 DB를 가리키는지 확인합니다.

## 4. 권장 적용 순서

테스트 DB 기준으로 아래 순서대로 적용합니다.

```powershell
node scripts/apply-supabase-sql.mjs `
  supabase/migrations/202605070001_phase1_foundation.sql `
  supabase/migrations/202605070002_phase1_existing_table_expansion.sql `
  supabase/migrations/202605070003_phase1_data_backfill.sql `
  supabase/migrations/202605070004_phase1_indexes_rls.sql
```

적용 후 검증 SQL을 실행합니다.

```powershell
node scripts/apply-supabase-sql.mjs `
  supabase/verification/phase1_backfill_checks.sql
```

검증 SQL은 데이터를 변경하지 않는 조회용입니다.

## 5. 검증 기준

### 테이블 존재

아래 테이블이 모두 있어야 합니다.

```text
homes
quotes
technicians
materials
media
inspections
feedbacks
warranty_cases
```

### 백필 건수

확인할 항목:

- `order_photos` 전체 건수와 `media where type = 'inquiry'` 건수
- `reviews` 전체 건수와 `feedbacks` 전체 건수
- 누락 row count가 0인지

### RLS

확인할 항목:

- 새 테이블 `rls_enabled = true`
- 새 테이블 `force_rls_enabled = true`
- `service_role_full_access_*` 정책 존재

## 6. 성공 후 다음 작업

마이그레이션이 테스트 DB에서 통과하면 API 리팩터를 시작합니다.

1. `/api/orders`
   - `customers upsert`
   - `homes insert`
   - `orders insert`
   - `orders.home_id` 연결
   - `orders.skus` 저장

2. `/api/quote`
   - DB 기준 가격 계산
   - `quotes.version` 증가
   - `quotes` row 저장

3. `/api/quotes/:id/accept`
   - 고객 견적 수락
   - `accepted_at` 기록

4. `/api/payments/toss/confirm`
   - 수락된 최신 `quotes.total_final` 기준 금액 검증

5. `/api/webhooks/toss`
   - webhook event 멱등 저장
   - `payment_id` 미매칭 event는 orphan으로 보존

## 7. 실패 시 대응

### 001 foundation 실패

enum 또는 새 테이블 생성 충돌 가능성이 큽니다.

확인:

- 기존에 같은 enum/type/table이 있는지
- 이전 마이그레이션이 일부만 적용됐는지

### 002 expansion 실패

기존 테이블 컬럼 추가 또는 FK 문제일 가능성이 큽니다.

확인:

- `customers`, `orders`, `payments`, `jobs`가 기존 MVP 스키마대로 존재하는지
- `homes`, `quotes`, `technicians`가 먼저 생성됐는지

### 003 backfill 실패

기존 데이터 이전 문제입니다.

확인:

- `order_photos`, `reviews` 테이블 존재 여부
- 기존 row의 FK가 깨져 있는지

### 004 indexes/RLS 실패

인덱스/정책/트리거 문제입니다.

확인:

- `set_updated_at()` 함수 존재 여부
- 기존 동일 policy가 남아 있는지
- service_role 정책 생성 권한이 있는지

## 8. 변경 기록 반영

테스트 DB 검증이 끝나면 `CHANGES_PHASE1.md`에 아래를 추가합니다.

```text
검증 일시:
적용 DB:
연결 정보 확인:
마이그레이션 결과:
검증 SQL 결과:
발견 이슈:
후속 조치:
```
