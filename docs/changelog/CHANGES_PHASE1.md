# Buildus Care Phase 1 변경 로그

## Phase 1 통합 검증 + 시공 사례 화면 구현 (2026-05-08)

### `/cases` 시공 사례 화면

- 기존 준비 중 placeholder를 실제 화면으로 교체했다.
- `GET /api/cases` 공개 API를 추가했다.
  - 기준 데이터: `jobs.status = inspected` + `media.type = after`
  - Supabase Storage signed URL을 서버에서 생성해 응답
  - `category`, `limit`, `offset` 파라미터 지원
- `/cases` 화면을 추가했다.
  - 헤더: `실제 시공 사례`
  - 탭 필터: 전체 / 배관 / 전기 / 도배 / 기타
  - 모바일 2열, 데스크톱 3열 카드 그리드
  - 서비스명 한글화: `formatServiceName()`
  - 완료 날짜: `formatKRDate()`
  - 피드백이 있으면 별점 표시
  - 데이터가 없으면 `아직 등록된 사례가 없습니다.` empty state 표시

### API 파일 존재 여부

- `app/api/orders/[id]/feedback/route.ts` OK
- `app/api/orders/[id]/media/route.ts` OK
- `app/api/orders/[id]/media/upload-url/route.ts` OK
- `app/api/orders/[id]/status/route.ts` OK
- `app/api/orders/[id]/warranty/route.ts` OK
- `app/api/admin/jobs/[id]/media/route.ts` OK
- `app/api/admin/jobs/[id]/media/upload-url/route.ts` OK
- `app/api/admin/feedbacks/route.ts` OK
- `app/api/cases/route.ts` OK

### DB 검증 SQL 결과

| 파일 | 주요 지표 | 결과 |
|---|---|---|
| `phase1_backfill_checks.sql` | 8개 Phase 1 테이블 존재, RLS/FORCE RLS 활성화, legacy source dropped 상태 대응 | PASS |
| `phase1_order_refactor_checks.sql` | customers/homes/orders 연결, access token 존재 | PASS |
| `phase1_quote_checks.sql` | quote version/accepted_at/total_final 확인 | PASS |
| `phase1_payment_checks.sql` | payments.status `done`, provider_status `DONE`, payment_events 멱등 키 확인 | PASS |
| `phase1_media_checks.sql` | media owner constraint, order/job media row 확인 | PASS |
| `phase1_feedback_checks.sql` | feedback rating/nps/categories/submitted_at 확인 | PASS |
| `phase1_jobs_checks.sql` | job 상태, inspections, job_status_logs 확인 | PASS |
| `phase1_masking_cleanup_checks.sql` | legacy table 4개 삭제 확인, replacement tables 존재 확인 | PASS |

### 환경변수 점검

- 코드 참조 환경변수 추출 후 `.env.example`과 대조했다.
- 누락 항목: `NEXT_PUBLIC_SITE_URL`
- 조치: `.env.example`에 `NEXT_PUBLIC_SITE_URL=https://buildus-care-flow.vercel.app` 추가

### 하드코딩 값 점검

- 주요 고객/관리자 플로우에서 고정 API 키 또는 UUID 하드코딩 없음.
- 탐지된 URL:
  - `app/robots.ts`, `app/sitemap.ts`의 `https://example.com` fallback
  - `app/flow/page.tsx`의 Unsplash 데모 이미지 URL
- 판단: `/flow` 레거시 데모 화면 및 안전한 fallback 성격이라 이번 작업에서는 유지

### 최종 빌드

- typecheck: PASS
- build: PASS

### 프로덕션 배포

- Production URL: `https://buildus-care-flow.vercel.app`
- Deployment URL: `https://buildus-care-flow-oyeqgi4px-juns-projects-58815d6e.vercel.app`
- Deployment ID: `dpl_C8f4rNpPBqCbpXDkegdENGqf63j4`
- 프로덕션 응답 확인:
  - `/cases` 200 OK
- `/api/cases` 200 OK

## Phase 3: 기사용 모바일 웹 앱 구현 (2026-05-08)

### 라우트

- `/technician/login`: 기사 토큰 로그인
- `/technician`: 오늘 + 미래 일정 목록
- `/technician/[jobId]`: 현장 상세
- `/technician/[jobId]/checkin`: 시공 시작
- `/technician/[jobId]/photos`: before/during/after 사진 업로드
- `/technician/[jobId]/complete`: 완료 보고

### 인증/보안

- `technicians.access_token`, `technicians.last_login_at` 컬럼 추가
- `?token=<technicianToken>` 진입 시 `tech_session` HttpOnly 쿠키 발급 후 `/technician`으로 이동
- `POST /api/technician/auth` 추가
- `middleware.ts`에서 `/technician` 경로 보호
- 모든 기사 API에서 `tech_session` 검증 및 `job.technician_id` 소유권 검증

### API

- `GET /api/technician/jobs`
- `GET /api/technician/jobs/:id`
- `PATCH /api/technician/jobs/:id/start`
- `PATCH /api/technician/jobs/:id/complete`
- `POST /api/technician/jobs/:id/media/upload-url`
- `POST /api/technician/jobs/:id/media`

### 현장 입력

- 시공 시작 시 `jobs.status = in_progress`, `started_at` 기록
- 완료 보고 시 `jobs.status = done`, `actual_minutes`, `materials_used`, `completion_notes`, `issues` 저장
- 사진 업로드 시 `media.job_id`, `media.type = before|during|after|material|issue` 저장
- 현장 상세는 시공 시작 24시간 전부터만 주소/전화 원본 노출, 그 전에는 마스킹

### 검증 결과

- `202605080003_technician_access_token.sql` 적용 완료
- `phase3_technician_checks.sql` 실행 완료
  - technician_token_count: 1
  - job_with_started_at: 2
  - job_with_actual_minutes: 0
  - tech_media_count: 1
- typecheck: PASS
- build: PASS
- Vercel 프로덕션 배포 완료
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-ny8z0q8kr-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_F6Sfdj4HyyVbs7gvXrfq6GdUqhFG`
- 프로덕션 응답 확인
  - `/technician/login` 200 OK
  - 토큰 없는 `/technician` 접근 307 redirect 확인

## 2026-05-07

### 결정

- Phase 1은 기능 추가보다 DB/API 구조 전환을 우선한다.
- 마이그레이션은 단일 파일이 아니라 논리 단위로 쪼개서 적용한다.
- 기존 MVP 코드를 바로 깨지 않도록 비파괴 확장 방식으로 시작한다.
- 실제 상태값 UPDATE는 API가 Phase 1 상태값을 지원한 뒤 별도 controlled migration으로 실행한다.

### 추가 문서

- `backend-spec.md`: Phase 1 백엔드 기준 스펙
- `phase1-implementation-brief.md`: 팀 공유용 구현 브리핑
- `CHANGES_PHASE1.md`: Phase 1 변경 로그

### 마이그레이션 분리

기존 단일 초안 `202605070001_phase1_schema.sql`은 제거하고 아래 4개로 분리했다.

1. `202605070001_phase1_foundation.sql`
   - enum 확장
   - `homes`, `quotes`, `technicians`, `materials`, `media`, `inspections`, `feedbacks`, `warranty_cases` 생성

2. `202605070002_phase1_existing_table_expansion.sql`
   - `customers`, `orders`, `payments`, `jobs` 확장
   - 기존 `approved_at`, `scheduled_date`, `completed_at` 값을 새 컬럼에 보강

3. `202605070003_phase1_data_backfill.sql`
   - `order_photos -> media` 이전
   - `reviews -> feedbacks` 이전
   - 주문 상태값 매핑은 주석으로 남기고 아직 실행하지 않음

4. `202605070004_phase1_indexes_rls.sql`
   - Phase 1 인덱스 추가
   - `materials` updated_at trigger 추가
   - 새 테이블 RLS 활성화
   - 새 테이블 FORCE RLS 활성화
   - service role 전용 정책 추가

### 검증 쿼리 추가

- `supabase/verification/phase1_backfill_checks.sql`
  - 새 테이블 생성 여부 확인
  - `order_photos -> media` 건수 비교
  - `reviews -> feedbacks` 건수 비교
  - 백필 누락 row 확인
  - RLS/FORCE RLS 상태 확인
  - 정책 존재 여부 확인
  - 샘플 row 수동 검토

### 다음 작업 후보

1. 테스트 DB에 4개 마이그레이션 순차 적용
2. `supabase/verification/phase1_backfill_checks.sql` 실행
3. `/api/orders`를 `customers + homes + orders` 생성 구조로 리팩터
4. `/api/quote`를 `quotes` 저장 구조로 리팩터
5. 결제를 수락된 최신 quote 기준으로 검증하도록 리팩터

### 실행 Runbook

- `phase1-migration-runbook.md`
  - 테스트 DB 적용 전 확인사항
  - `MIGRATION_DATABASE_URL` 기준 적용 권장
  - 적용 전 DB 식별 정보 확인
  - 마이그레이션 적용 순서
  - 검증 기준
  - 실패 시 대응
  - 검증 결과 기록 양식

### 적용 스크립트 보강

- `scripts/apply-supabase-sql.mjs`
  - `MIGRATION_DATABASE_URL`을 우선 사용하고, 없으면 `DATABASE_URL`을 사용
  - SQL 적용 전 현재 접속 DB 식별 정보를 출력
  - 검증 SQL처럼 SELECT 문이 있는 파일은 결과를 콘솔 table로 출력

### 마이그레이션 첫 적용

- 테스트 DB 연결 확인 성공
- 4개 Phase 1 마이그레이션 적용 성공
- `phase1_backfill_checks.sql` 실행 성공
- 검증 결과:
  - 새 테이블 8개 모두 존재 확인: `feedbacks`, `homes`, `inspections`, `materials`, `media`, `quotes`, `technicians`, `warranty_cases`
  - `order_photos -> media`: source 0 / target 0
  - `reviews -> feedbacks`: source 0 / target 0
  - 백필 누락: 0건
  - 새 테이블 RLS enabled: true
  - 새 테이블 FORCE RLS enabled: true
  - service role full access policy 8개 확인
  - media/feedbacks 샘플 row 없음. 현재 테스트 DB에 백필 대상 데이터가 없음

### API 리팩터 필수 수집값 확정

- `/api/orders` 리팩터 시 엑셀 P0 기준 필수 수집값을 누락하지 않는다.
  - `customers.acquisition_source`
  - `orders.channel`
  - `orders.reason`
  - `orders.urgency`
  - `homes.year_built`
  - `orders.skus`
- `orders.self_diagnosis`는 P1 성격이지만 AI 의도 학습을 위해 입력/저장 구조를 유지한다.

### `/api/orders` Phase 1 리팩터

- `customers`는 phone 기준으로 조회 후 생성/갱신한다.
  - 기존 고객이면 `first_contact_at`은 유지한다.
  - 주소/유입 스냅샷은 최신 주문 기준으로 갱신한다.
- `homes`는 같은 `customer_id + address_full`이면 재사용한다.
- `orders`는 `home_id`, `channel`, `reason`, `urgency`, `skus`, `self_diagnosis`를 저장한다.
- `order_number`는 `BO-YYYYMMDD-NNNN` 형식으로 생성한다.
- 응답에 `statusUrl`을 포함한다.
- 검증 문서 추가: `docs_phase1_order_refactor_test.md`
- DB 검증 SQL 추가: `supabase/verification/phase1_order_refactor_checks.sql`
- 검증 결과:
  - 첫 주문 생성 성공
  - 같은 고객/주소 재주문 성공
  - `customer_count = 1`
  - `home_count = 1`
  - `order_count = 3`
  - 최신 주문번호 형식 확인: `BO-20260507-0005`

### `/api/quote` Phase 1 리팩터

- `order_id`가 없으면 기존처럼 견적 미리보기로 동작한다.
- `order_id`가 있으면 `quotes` row를 저장한다.
- `service_items` DB 가격 기준으로 시공비를 계산한다.
- 프론트가 보낸 `unit_price`는 신뢰하지 않고 metadata에 `client_unit_price_ignored`로만 남긴다.
- `materials`의 `retail_price`는 `metadata.material_skus`가 있을 때 자재가에 반영한다.
- `version = 기존 최대 + 1`로 저장한다.
- `/api/quotes/:id/accept`를 추가했다.
  - 최초 수락 시 `accepted_at` 기록
  - 재수락 시 `409 conflict`
- DB 검증 SQL 추가: `supabase/verification/phase1_quote_checks.sql`
- 검증 문서 추가: `docs_phase1_quote_refactor_test.md`
- 검증 결과:
  - 동일 주문에 견적 2회 생성 성공
  - `version = 1, 2` 증가 확인
  - 최초 수락 `200 OK`
  - 동일 견적 재수락 `409 Conflict`
  - `quote_count = 2`
  - `first_version = 1`
  - `latest_version = 2`
  - `accepted_count = 1`

### `/api/payments/toss/confirm` Phase 1 리팩터

- 결제 승인 전 accepted quote를 필수로 확인한다.
- accepted quote가 없으면 `400 QUOTE_REQUIRED`.
- 요청 금액이 `acceptedQuote.total_final`과 다르면 `400 AMOUNT_MISMATCH`.
- `payments.quote_id`에 수락 견적 FK를 저장한다.
- 성공 시 `payments.status = done`, `paid_at`, `approved_at`, `provider_status`를 기록한다.
- 성공 시 `orders.status = paid`.
- 동일 paymentKey 재요청은 기존 payment와 order/quote/amount가 같으면 멱등 성공.
- webhook 수신 시 paymentKey로 기존 orphan event를 찾아 `payment_id`를 후속 업데이트한다.
- DB 검증 SQL 추가: `supabase/verification/phase1_payment_checks.sql`
- 검증 문서 추가: `docs_phase1_payment_refactor_test.md`
- 검증 결과:
  - 수락된 quote 없는 주문 confirm: `400 QUOTE_REQUIRED`
  - 금액 불일치 confirm: `400 AMOUNT_MISMATCH`
  - 정상 confirm: `200 OK`
  - 동일 paymentKey 재요청: `200 OK`, `duplicate = true`
  - webhook 첫 수신: `201`, `duplicate = false`
  - webhook 동일 이벤트 재수신: `200 OK`, `duplicate = true`
  - `payments.status = done`
  - `payments.quote_id` 연결 확인
  - `payments.paid_at/approved_at` 기록 확인
  - `orders.status = paid`
  - `payment_events` confirm/webhook event 각각 1건 확인

### Media API Phase 1 리팩터

- 고객 의뢰 사진 API를 `media` 테이블 기준으로 추가했다.
  - `POST /api/orders/:id/media/upload-url`
  - `POST /api/orders/:id/media`
- 기사 시공 사진 API를 `media` 테이블 기준으로 추가했다.
  - `POST /api/admin/jobs/:id/media/upload-url`
  - `POST /api/admin/jobs/:id/media`
- Storage path 규칙:
  - 고객 의뢰 사진: `orders/{orderId}/inquiry/{uuid}_{filename}`
  - 기사 시공 사진: `jobs/{jobId}/{type}/{uuid}_{filename}`
- 고객 사진 metadata는 `media.order_id`, `type = inquiry`로 저장한다.
- 기사 사진 metadata는 `media.job_id`, `type = before/during/after/material/issue`로 저장한다.
- `sort_order`는 같은 `order_id` 또는 `job_id` 기준 기존 최대 + 1로 자동 부여한다.
- `order_photos`에는 더 이상 새 media API metadata를 저장하지 않는다.
- `media_owner_check`를 강화해 `order_id`와 `job_id` 중 정확히 하나만 허용한다.
- DB 검증 SQL 추가: `supabase/verification/phase1_media_checks.sql`
- 검증 문서 추가: `docs_phase1_media_refactor_test.md`
- 검증 결과:
  - 고객 upload URL path 확인: `orders/{orderId}/inquiry/{uuid}_inquiry.jpg`
  - 기사 upload URL path 확인: `jobs/{jobId}/before/{uuid}_job-before.jpg`
  - 같은 주문 사진 3장 저장 성공
  - 고객 media `type = inquiry`
  - 기사 media `type = after`
  - `sort_order = 1, 2, 3`
  - 잘못된 owner 입력 `400 VALIDATION_ERROR`
  - `order_media_count = 3`
  - `job_media_count = 1`
  - `invalid_both_owner_count = 0`
  - `invalid_missing_owner_count = 0`
  - `media_owner_check` XOR 제약 확인

### Feedback API Phase 1 리팩터

- 고객 후기/NPS API를 `feedbacks` 테이블 기준으로 추가했다.
  - `POST /api/orders/:id/feedback`
  - `GET /api/orders/:id/feedback`
  - `GET /api/admin/feedbacks`
- `feedbacks`에 Phase 1 고객용 필드를 보강했다.
  - `rating`
  - `comment`
  - `categories`
  - `nps`는 선택값으로 변경
- 새 피드백은 `reviews`에 저장하지 않고 `feedbacks`에만 저장한다.
- 제출 가능 주문 상태:
  - `paid`
  - `completed`
  - `done`
- 같은 주문 재제출은 `409 ALREADY_SUBMITTED`.
- 미결제/미완료 주문 제출은 `400 ORDER_NOT_ELIGIBLE`.
- 고객 조회는 주문 `accessToken` 또는 관리자 키가 있어야 가능하다.
- 관리자 목록은 `order_id`, `rating`, `nps_min`, `date_from`, `date_to`, `limit`, `offset`을 지원한다.
- DB 검증 SQL 추가: `supabase/verification/phase1_feedback_checks.sql`
- 검증 문서 추가: `docs_phase1_feedback_refactor_test.md`
- 검증 결과:
  - 정상 피드백 제출 성공
  - `rating = 5`
  - `nps = 10`
  - `categories.quality = 5`
  - 동일 주문 재제출 `409`
  - 미결제 주문 제출 `400`
  - 고객 피드백 조회 성공
  - 관리자 필터 조회 성공
  - `feedback_count = 1`
  - `duplicate_feedback_orders = 0`

### Jobs 운영 API Phase 1 리팩터

- 운영자 jobs API를 Phase 1 현장 운영 흐름으로 확장했다.
  - `POST /api/admin/jobs`
  - `PATCH /api/admin/jobs/:id/start`
  - `PATCH /api/admin/jobs/:id/complete`
  - `PATCH /api/admin/jobs/:id/inspect`
  - `GET /api/admin/jobs`
  - `GET /api/admin/jobs/:id`
- 상태값 보강:
  - `job_status`: `done`, `inspected`
  - `order_status`: `issue`
- 검수 필드 보강:
  - `jobs.inspected_at`
  - `inspections.inspector_note`
  - `inspections.inspected_at`
- 기사 배정 시:
  - `job.status = scheduled`
  - `orders.status = scheduled`
- 시공 시작 시:
  - `job.status = in_progress`
  - `jobs.started_at` 기록
  - `orders.status = in_progress`
- 시공 완료 시:
  - `job.status = done`
  - `jobs.completed_at`, `jobs.ended_at` 기록
  - `orders.status = completed`
- 검수 통과 시:
  - `job.status = inspected`
  - `inspections` row 생성
  - `orders.status = done`
- 검수 불합격 시:
  - `inspections.passed = false`
  - `orders.status = issue`
- 상태 전이 제약:
  - start는 `scheduled`에서만 가능
  - complete는 `in_progress`에서만 가능
  - inspect는 `done`에서만 가능
- DB 검증 SQL 추가: `supabase/verification/phase1_jobs_checks.sql`
- 검증 문서 추가: `docs_phase1_jobs_refactor_test.md`
- 레거시 테이블 삭제 후보 문서 추가: `docs_phase1_legacy_table_cleanup_plan.md`
- 검증 결과:
  - 기사 배정 성공: `job.status = scheduled`, `orders.status = scheduled`
  - 시공 시작 성공: `job.status = in_progress`
  - 잘못된 start 재호출: `400 INVALID_STATUS`
  - 시공 완료 성공: `job.status = done`
  - 검수 통과 성공: `orders.status = done`
  - 검수 불합격 성공: `orders.status = issue`
  - 목록 필터 조회 성공
  - 단건 조회에서 order join 확인
  - `inspected_count = 2`
  - `started_at_count = 2`
  - `completed_at_count = 2`
  - `inspected_at_count = 2`

### Step 7 게스트 상태 조회 마스킹 + 레거시 테이블 삭제

- `GET /api/orders/:id/status`를 고객용/관리자용으로 분리했다.
- 고객용은 `accessToken` 필수이며 잘못된 토큰은 `403 FORBIDDEN`.
- 관리자용은 `x-admin-key`로 조회하며 마스킹 없이 전체 정보를 조회한다.
- 고객용 마스킹:
  - `customer.phone`: `010-****-8888`
  - `customer.name`: `김**`
  - `home.address_full`: `경기 수원시 영통구 테스트로 77 ***호`
- 고객용 quote 응답은 `total_final` 중심으로 제한한다.
  - 노출 key: `accepted_at`, `id`, `quoted_at`, `total_final`, `version`
  - quote item 단가 미노출
- 고객용 payment 응답에서 `payment_key` 미노출.
- 삭제 대상 레거시 테이블 참조를 코드에서 제거했다.
  - `order_photos`
  - `reviews`
  - `addresses`
  - `order_items`
- 기존 `/api/reviews`는 호환을 위해 남기되, 새 저장 대상은 `feedbacks`로 변경했다.
- 기존 `/api/orders/:id/photos`는 호환을 위해 남기되, 새 저장 대상은 `media`로 변경했다.
- 삭제 마이그레이션 추가 및 테스트 DB 적용:
  - `supabase/migrations/202605070008_phase1_drop_legacy_tables.sql`
- DB 검증 SQL 추가:
  - `supabase/verification/phase1_masking_cleanup_checks.sql`
- 검증 문서 추가:
  - `docs_phase1_masking_cleanup_test.md`
- `products`, `reservations` 점검:
  - `products`: 현재 코드 직접 참조 없음. 카탈로그 정책 확정 전까지 실제 삭제 보류.
  - `reservations`: 예약 API/status/flow에서 참조 중이므로 유지.
- 검증 결과:
  - 올바른 accessToken 상태 조회 성공
  - 전화번호/이름/주소 마스킹 확인
  - quote 단가 미노출 확인
  - 잘못된 accessToken `403`
  - 관리자 키 조회 시 원본 phone/name/address 확인
  - 삭제 후 `POST /api/orders` 정상
  - 삭제 후 `POST /api/orders/:id/media` 정상
  - 삭제 후 `POST /api/orders/:id/feedback` 정상
  - `remaining_legacy_table_count = 0`

### `/quote/[serviceCode]` 견적 상세 페이지

- 신규 페이지 추가:
  - `app/quote/[serviceCode]/page.tsx`
  - `app/quote/[serviceCode]/quote-detail-client.tsx`
- 카톡/광고/지역 딥링크 파라미터를 처리한다.
  - `region`
  - `source`
  - `product`
  - `addons`
  - `campaign`
- 상단 컨텍스트 배너를 source/region 기준으로 표시한다.
- `service_items` 기반으로 서비스명, 카테고리, 예상 소요시간, 시작가를 표시한다.
- 자재 등급과 addon 선택에 따라 가격을 실시간 합산한다.
- 표준 시공이면 사진, 주소, 예약일, 고객 정보, 결제 CTA를 표시한다.
- 비표준 시공이면 결제 UI를 숨기고 상담 CTA를 표시한다.
- 결제 전 호출 순서:
  - `POST /api/orders`
  - `POST /api/orders/:id/media/upload-url`
  - `POST /api/orders/:id/media`
  - `POST /api/orders/:id/reservation`
  - `POST /api/quote`
  - `POST /api/quotes/:id/accept`
  - `POST /api/payments/toss/confirm`
- 결제 성공 후 `/orders/:orderId?accessToken=...`로 이동한다.
- 주문 상태 페이지 추가:
  - `app/orders/[id]/page.tsx`
- 신규 helper:
  - `lib/service-items.ts`
  - `lib/quote-preset.ts`
- 신규 컴포넌트:
  - `components/quote/PriceSummary.tsx`
  - `components/quote/AddonSelector.tsx`
  - `components/quote/PhotoUploader.tsx`
- service item 보강 마이그레이션 추가:
  - `supabase/migrations/202605070009_service_items.sql`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - Vercel 프로덕션 재배포 완료
  - `/`, `/quote/toilet_replace`, `/orders/lookup` 200 OK 확인
  - `POST /api/orders/lookup` 운영 주문 전화번호 기준 링크 반환 확인
- Vercel 배포:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-fu3q1msvg-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_Afb6t6tUX6Lo6XAES4e29GQp2MKZ`

## 예약/결제/UX 자율 검증 및 수정 (2026-05-08)

### 검증 범위별 결과

- 에러 코드 고객 노출:
  - 고객 화면에서 API `error.code`나 기술적인 영어 메시지가 그대로 노출될 수 있는 경로를 확인했다.
  - `lib/error-messages.ts`를 추가해 `SLOT_FULL`, `QUOTE_REQUIRED`, `AMOUNT_MISMATCH`, `ORDER_NOT_ELIGIBLE`, `NPS_REQUIRED`, `ORDER_NOT_COMPLETED` 등 주요 고객 경로 에러를 한글 안내로 매핑했다.
  - `/quote/[serviceCode]`, `/orders/[id]`의 결제 승인, 후기 제출, A/S 접수 에러 표시를 공통 매핑 함수로 교체했다.
- 캘린더/슬롯 UI:
  - `/api/slots` 응답 도착 전 슬롯이 선택 가능한 상태로 보일 수 있는 여지를 차단했다.
  - 슬롯 로딩 중 날짜/슬롯 버튼을 비활성화하고 스켈레톤을 표시하도록 수정했다.
  - 슬롯 API 실패 시 `날짜를 불러올 수 없습니다. 다시 시도해주세요.` 안내와 재시도 버튼을 추가했다.
  - 월 이동 시 이전 달 슬롯 데이터가 남지 않도록 즉시 슬롯 상태를 초기화하도록 수정했다.
- 결제 실패/이탈 복귀:
  - `?toss=fail` 안내 메시지와 기존 입력값 복원 로직이 존재함을 확인했다.
  - 결제창 진입 직전에 생성된 주문/견적을 `sessionStorage`에 저장하고, 동일 입력값으로 재시도하면 기존 order/quote를 재사용하도록 보강했다.
  - 이로써 결제 실패 후 다시 결제할 때 동일 주문이 중복 생성되는 위험을 줄였다.
- 모바일 레이아웃:
  - 375px 기준 캘린더 셀 크기, 슬롯 카드, 가격 요약, 주문 타임라인의 줄바꿈 취약 지점을 보강했다.
  - 긴 서비스명/금액/주소가 부모 영역을 넘치지 않도록 `overflow-wrap`와 모바일 전용 캘린더 크기 조정을 추가했다.
- 빈 상태/로딩 상태:
  - `/cases`는 로딩/에러/0건 empty state가 이미 있어 문제 없음 확인.
  - `/orders/[id]`는 accessToken 없음, 403, 404, 네트워크 오류 안내가 이미 있어 문제 없음 확인.
  - `/technician/[jobId]`는 없는 job 안내가 있었고, 네트워크 실패 시 로딩에 머물 수 있는 부분을 실패 안내 상태로 보강했다.

### 검증 결과

- `npm run typecheck` 통과
- `npm run build` 통과
- Vercel 프로덕션 배포 완료
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-lv7jcs5z0-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_B7iiybGK7uuQ7Z3Tk93b5skitqiH`
- 재배포 후 프로덕션 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/login` 200 OK

## 예약 변경 셀프 UI (2026-05-11)

- 고객 주문 상태 페이지(`/orders/[id]`)에 예약 변경 버튼과 날짜/오전·오후 선택 모달을 추가했다.
- `PATCH /api/orders/:id/reschedule`을 추가했다.
  - 고객 `accessToken` 검증
  - `paid`/`scheduled` 상태에서만 변경 허용
  - `in_progress`/`done`/`inspected` 작업은 변경 차단
  - 기존 주문의 active reservation/job은 슬롯 카운트에서 제외
  - 동일 날짜/동일 슬롯 재요청은 200 OK 멱등 처리
- 예약 변경 시 기존 active reservation은 `cancelled` 처리하고 새 `confirmed` reservation을 생성한다.
- 기존 job이 있고 같은 기사 유지가 가능하면 `jobs.scheduled_at`을 KST 기준으로 갱신한다.
- 같은 기사 유지가 어렵다면 기존 job을 `cancelled` 처리하고 주문 상태를 `paid`로 되돌려 기사 재배정 대기 상태로 표시한다.
- `events`에 `reservation_rescheduled` 이벤트를 기록한다.

## 고객 주문 상태 타임라인/문구 정리 (2026-05-11)

- `docs/order-status-mapping.md`에 고객 주문 상태 설계표를 추가했다.
- `lib/order-status-label.ts`를 추가해 `orders.status + jobs.status` 조합별 고객용 라벨/안내 문구를 한 곳에서 관리하도록 했다.
- `/orders/[id]` 현재 진행 상태와 타임라인 문구를 새 헬퍼 기반으로 통일했다.
- `paid + job 없음`은 "결제 완료, 기사 배정 중"으로, `paid|scheduled + job scheduled`는 "방문 예약 확정"으로 분리했다.
- 기존 9단계 타임라인의 "자재 준비 중" 과잉 노출을 제거하고 `견적/결제 → 기사 배정/예약 확정 → 시공 중 → 시공 완료 → A/S` 흐름으로 단순화했다.

## 견적 결제 고객 정보 런타임 방어 (2026-05-11)

- `/quote/[serviceCode]` 결제 준비 중 `Cannot read properties of undefined (reading 'name')`가 발생할 수 있는 경로를 방어했다.
- 오래된 브라우저 `sessionStorage` 또는 비정상 상태 복원으로 `customer` 객체가 비어도 `customerName`, `customerPhone` 안전 문자열을 통해 검증/주문 생성/Toss 호출이 동작하도록 정리했다.
- 이름/전화번호 입력 `onChange`도 기존 상태가 비어 있을 때 기본 구조를 복원하도록 보강했다.

## 브라우저 테스트 결제 모드 추가 (2026-05-11)

- `NEXT_PUBLIC_PAYMENT_MOCK_MODE` 브라우저 플래그를 추가했다.
- `/quote/[serviceCode]`에서 mock 모드일 때 Toss SDK를 열지 않고 `mock-{orderId}` paymentKey로 `/api/payments/toss/confirm`을 직접 호출하도록 했다.
- mock confirm 성공 후 실제 주문 상태 페이지(`/orders/{orderId}?accessToken=...`)로 이동해 고객 UX 전체를 카드 결제 없이 검증할 수 있게 했다.
- 실제 결제 모드에서는 기존 Toss `requestPayment()` 흐름을 그대로 유지한다.
- `.env.example`, `.env.local`에 `NEXT_PUBLIC_PAYMENT_MOCK_MODE` 항목을 추가했다.

## Phase 2: 레퍼런스 조사 기반 신뢰 UX 보강 (2026-05-11)

- 웹 레퍼런스 조사를 통해 주거 설비 시공, 홈서비스 플랫폼, 예약 서비스의 신뢰 UX를 비교했다.
  - 직접 경쟁자: 바스리모, 수리쟁이, 전기삼촌, 누수뚝
  - 간접 경쟁자: 숨고, 크몽, 당근 동네지도
  - 예약 벤치마크: 네이버 예약, 카카오헤어샵
- `COMPETITOR_ANALYSIS.md`를 추가했다.
  - FAQ, 기사/전문가 프로필, 후기/보증/인증 요소를 Buildus Care 현황과 비교
  - 즉시 적용 항목을 FAQ 섹션과 기사 프로필 보강으로 확정
- `ROADMAP.md`를 추가했다.
  - Phase 1 완료 범위
  - Phase 2 신뢰 UX 보강
  - Phase 3 예약 변경/알림 자동화
  - Phase 4 이후 쿠폰, 기사 비교, 채팅, 평점 시스템 로드맵 정리
- FAQ 기능을 추가했다.
  - `supabase/migrations/202605110008_faqs_and_technician_profiles.sql`
  - `faqs` 테이블 생성, RLS/FORCE RLS 활성화, service role 정책 추가
  - 기본 FAQ 6개 시드
  - `GET /api/faqs` 공개 API 추가
  - 홈 하단 FAQ 아코디언 추가
  - `/admin/settings` FAQ 관리 섹션 추가
  - `/api/admin/faqs` 및 수정/삭제/순서변경 API 추가
- 기사 프로필 기능을 추가했다.
  - `technicians.experience_years`, `specialties`, `bio`, `profile_image_url` 컬럼 추가
  - `/admin/technicians` 기사 등록 폼에 경력, 전문 분야, 한 줄 소개, 프로필 사진 URL 입력 추가
  - 기사 목록에서 경력/전문 분야/소개 요약 표시
  - `/api/orders/:id/status`가 기사 프로필 필드를 함께 반환하도록 조인 확장
  - `/orders/[id]` 주문 상태 페이지에 담당 기사 프로필 카드 추가
- 운영 DB 검증:
  - `faqs_table_exists = 1`
  - `active_faq_count = 6`
  - `technician_profile_columns = 4`
  - `faqs.row_security = true`
  - `faqs.force_row_security = true`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
- Vercel 프로덕션 재배포 완료:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-7vdvumv68-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_FC9dhvGboHWW73GDsL6n23qEQa3P`

## 결제 성공 리다이렉트 파라미터 보강 (2026-05-11)

- `/quote/[serviceCode]` 결제 흐름을 점검했다.
  - `POST /api/orders`
  - `POST /api/orders/:id/reservation`
  - `POST /api/quote`
  - `POST /api/quotes/:id/accept`
  - Toss SDK `requestPayment()`
- `/orders/[id]` 성공 처리 흐름을 점검했다.
  - `toss=success`, `paymentKey`, `amount`가 모두 있을 때 `/api/payments/toss/confirm` 호출
  - confirm 성공 후 주문 상태 재조회
- `/api/payments/toss/confirm` 검증 흐름을 점검했다.
  - 최신 accepted quote 조회
  - `acceptedQuote.total_final`과 요청 `amount` 비교
  - 결제 성공 시 `payments.status = done`, `provider_status = DONE`, `orders.status = paid` 업데이트
- 확인된 취약 지점:
  - `successUrl`이 `accessToken`과 `toss=success`만 직접 포함하고, `amount`는 Toss 리다이렉트 파라미터에 의존했다.
  - `/orders/[id]` 클라이언트는 `paymentKey`와 `amount`가 모두 있어야 confirm을 호출하므로, 리다이렉트 URL에 `amount`가 빠지면 confirm이 스킵될 수 있었다.
- 최소 패치:
  - Toss `successUrl`에 `orderId`, `amount`, `serviceCode`를 명시적으로 포함했다.
  - `/orders/[id]` confirm 처리 후 URL에서 보조 파라미터를 함께 제거하도록 정리했다.
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과

### 견적 페이지 draft 복원 오류 수정 (2026-05-11)

- `/quote/[serviceCode]`에서 `Cannot read properties of undefined (reading 'trim')` 런타임 오류가 발생할 수 있던 원인을 수정했다.
- 원인:
  - 브라우저 `sessionStorage`에 저장된 이전 견적 draft가 최신 상태 구조보다 오래되어 `customer.name`, `homeInfo.floor`, `complexName` 등이 누락될 수 있었다.
  - 누락된 값이 그대로 state에 복원되면 렌더링 또는 결제 준비 중 `.trim()` 호출에서 오류가 발생했다.
- 수정:
  - `normalizeDraftAddress`
  - `normalizeDraftHomeInfo`
  - `normalizeDraftCustomer`
  - `optionalNumber` undefined-safe 처리
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과

## 고객 직접 취소/환불 + 전환 속도 개선 (2026-05-11)

- 취소/환불 정책을 `app_configs` 기준으로 저장했다.
  - 전액 환불: 결제 후 24시간 이내 + 방문 3일 이상 전
  - 부분 환불: 방문 1일 이상 전, 기본 50%
  - 환불 불가: `in_progress`, `completed`, `done`, `warranty`, 취소 완료 상태
- `cancellations` 테이블과 `orders.payment_key` 컬럼을 추가했다.
  - `supabase/migrations/202605110006_cancellations.sql`
  - `supabase/verification/cancellations_checks.sql`
- 고객용 `POST /api/orders/:id/cancel`을 추가했다.
  - `paid`, `scheduled` 주문에서 accessToken으로 취소 요청 가능
  - 전액 환불 조건은 Toss 취소 API로 자동 처리
  - 부분/수동 조건은 `cancel_requested` 상태로 전환 후 관리자 처리 대기
- Toss 취소 유틸을 추가했다.
  - `lib/toss.ts`의 `cancelTossPayment`
  - mock paymentKey는 QA 흐름을 위해 mock 취소 응답 유지
- 결제 confirm 성공 시 `orders.payment_key`를 함께 저장하도록 수정했다.
- 주문 현황 페이지에 취소 버튼, 환불 예상액 모달, 취소 요청/취소 완료 상태 안내를 추가했다.
- 관리자 주문 목록에 취소 요청 처리 UI를 추가했다.
  - `POST /api/admin/cancellations/:id/approve`
  - `POST /api/admin/cancellations/:id/reject`
  - 주문 사이드바에 미배정/취소요청 배지를 분리 표시
- `/admin/settings`에 취소 정책 편집 섹션을 추가했다.
- 페이지 전환 체감 속도를 개선했다.
  - `/api/slots` revalidate 30초
  - `/api/service-items` revalidate 1시간
  - 홈 서비스 카드 prefetch 명시
  - 관리자/주문/견적 주요 화면 loading skeleton 추가
- 운영 DB 검증 결과:
  - `cancellations_table_exists = 1`
  - `order_payment_key_column_exists = 1`
  - `cancel_policy_config_count = 4`
  - `pending_cancel_requests = 0`
  - `cancel_requested_orders = 0`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과

## 속도 최적화 2차 — 관리자/고객 병목 제거 (2026-05-11)

- 성능 계측 유틸 `lib/perf.ts`를 추가했다.
  - 주요 서버 데이터 로딩 구간을 `[perf] label: Nms` 형식으로 Vercel 함수 로그에 남긴다.
- 관리자 페이지 데이터 로딩을 병렬화/계측했다.
  - `/admin/orders`: 주문 목록, 서비스 목록, 기사 목록 병렬 fetch
  - `/admin/analytics`: 주문/결제/판정/이벤트/A/S 만료 집계 병렬 fetch
  - `/admin/diagnoses`: 목록 조회와 signed URL 생성 구간 계측
  - `/admin/technicians`: 기사 목록과 주간 배정 건수 병렬 fetch
  - `/admin/slots`: slots/config/jobs fetch를 클라이언트에서 병렬화
- 과도한 `select('*')`를 줄였다.
  - `/admin/orders` 페이지와 `/api/admin/orders`에서 목록에 필요한 컬럼만 조회
  - `/admin/diagnoses`에서 진단 목록에 필요한 컬럼만 조회
  - `/admin/technicians`에서 기사 목록에 필요한 컬럼만 조회
- 페이지네이션을 강화했다.
  - `/admin/orders`: 20건 단위, count 기반 이전/다음 페이지
  - `/admin/diagnoses`: page 기반 20건 단위 페이지네이션
- 중복 fetch를 제거했다.
  - `/quote/[serviceCode]`에서 addon 조회 시 service item을 다시 조회하던 경로 제거
- 운영 DB 성능 인덱스를 추가하고 `ANALYZE`를 수행했다.
  - `supabase/migrations/202605110007_perf_indexes.sql`
  - `idx_orders_status_created_at`
  - `idx_orders_created_at`
  - `idx_customers_phone_created_at`
  - `idx_jobs_order_id`
  - `idx_jobs_technician_scheduled_at`
  - `idx_jobs_scheduled_at`
  - `idx_reservations_reserved_date_time_slot`
  - `idx_diagnoses_result_created_at`
  - `idx_events_order_id_created_at`
  - `idx_notifications_template_code_created_at`
- 검증 문서와 SQL을 추가했다.
  - `PERF_REPORT.md`
  - `supabase/verification/perf_indexes_checks.sql`
- 운영 DB 검증 결과:
  - 성능 인덱스 10개 확인
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과

## 슬롯 cap 활성 기사 자동 연동 + 기사 배정 UI 개선 (2026-05-11)

- 운영 DB 현재 상태를 확인했다.
  - 활성 기사: 2명
  - 기존 `app_configs.slot_cap = 3` 수동 설정 확인
  - 미래 일정 기준 날짜/슬롯별 기사 배정 현황 확인
- 슬롯 cap 결정 로직을 변경했다.
  - 1순위: `app_configs.slot_cap`
  - 2순위: `technicians.is_active = true` 기사 수
  - 3순위: `MAX_SLOTS_PER_PERIOD` fallback
- 운영 DB 수동 cap을 제거했다.
  - `supabase/migrations/202605110005_auto_slot_cap_by_active_technicians.sql`
  - `app_configs.slot_cap` 삭제
  - legacy `slot_configs.type = cap` 삭제
- `/api/slots` 응답 검증:
  - `maxSlotsPerPeriod = 2`
  - `effectiveMaxSlotsPerPeriod = 2`
  - `capSource = active_technicians`
  - `activeTechnicianCount = 2`
- 관리자 설정 페이지를 보강했다.
  - 슬롯 cap 입력을 비워두거나 0으로 저장하면 활성 기사 수 자동 연동 모드로 전환
  - 설명 문구를 “비워두면 활성 기사 수 기준으로 자동 설정”으로 수정
- 관리자 주문 관리에 기사 배정 UI를 추가했다.
  - `/admin/orders` paid/scheduled 주문에 `기사 배정` 버튼 노출
  - `/admin/orders/[id]` 주문 상세에서도 기사 배정/취소 가능
  - 배정 모달에서 활성 기사만 표시
  - 선택 날짜/오전·오후 기준 기사별 기존 배정 건수 표시
- 기사 배정 API를 보강했다.
  - `POST /api/admin/jobs`에서 결제/배정 가능 상태 검증
  - 비활성 기사 배정 차단
  - 과거 시간 배정 차단
  - 동일 기사 동일 날짜/슬롯 중복 배정 차단 (`TECHNICIAN_OVERLOADED`)
  - `DELETE /api/admin/jobs/:id` 배정 취소 API 추가, 주문 상태를 `paid`로 복원
- 관리자 슬롯 관리 UI를 개선했다.
  - `/admin/slots` 날짜 셀에 오전/오후 사용량과 배정 기사명 표시
  - 날짜 클릭 시 배정 현황 사이드 패널 표시
  - 패널에서 날짜 차단/해제 가능
  - 수동 cap 저장 또는 자동 cap 전환 가능
- 기사 관리 UI/API를 보강했다.
  - `/admin/technicians` 기사별 이번 주 배정 건수와 남은 슬롯 표시
  - `GET /api/admin/technicians/:id/schedule?month=YYYY-MM` 추가
  - 기사 일정 보기 모달 추가
- 관리자 사이드바에 미배정 주문 배지를 추가했다.
  - `GET /api/admin/orders/unassigned-count`
  - paid 상태이면서 활성 배정 job이 없는 주문 수를 30초마다 갱신
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - Vercel 프로덕션 재배포 완료
  - `/api/slots?year=2026&month=5`에서 `maxCount = 2` 확인
  - `/admin/slots`, `/admin/orders`, `/admin/technicians` 200 OK 확인
- Vercel 배포:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-nigb8spcj-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_24cmjev87gTvJxqdWuUUDnrEMf8A`

## 실제 고객 주문 현황 QA + 링크 재조회 보강 (2026-05-11)

- 운영 DB 기준 주문 현황을 확인했다.
  - 최근 5개 주문 모두 `access_token` 보유
  - 주문 상태 분포: `inquiry`, `paid`, `payment_pending`, `warranty`, `issue`, `done`, `in_progress` 등 혼재
- 고객 주문 확인 흐름에서 발견한 운영 구멍을 수정했다.
  - `POST /api/orders`의 `statusUrl`이 API 주소로 내려가던 문제 수정
  - 고객용 현황 링크를 `/orders/[id]?accessToken=...`로 통일
- `/orders/[id]` 주문 현황 페이지를 보강했다.
  - 결제 완료 후 북마크 안내/공유 버튼 표시
  - 주문 기본 정보 카드 추가
  - 결제 금액/결제 수단 표시 보강
  - 담당 기사 연락처 또는 대표번호 표시
  - 상태별 고객 안내 메시지 추가
  - 예약 변경/취소 문의 안내 추가
- 주문 현황 링크 재조회 기능을 추가했다.
  - `/orders/lookup`
  - `POST /api/orders/lookup`
  - 전화번호로 최근 주문 현황 링크 조회
  - 5분 3회 제한의 간단 rate limit 적용
  - 실제 SMS/카카오 연동 전까지 화면에 링크 직접 표시
- 고객용 주문 상태 API를 보강했다.
  - `/api/orders/:id/status`에서 `jobs.technicians(name, phone)` 조인
- 관리자 주문 취소 API를 추가했다.
  - `PATCH /api/admin/orders/:id`
  - `cancelled` 입력은 내부 상태 `canceled`로 정규화
- QA 문서를 추가했다.
  - `QA_REPORT.md`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과

## 운영 시작 준비 후속 보강 (2026-05-11)

- 웹/PWA/WebView 하단 상태바 대응을 추가했다.
  - `viewport-fit=cover` 및 iOS/Android safe area CSS 변수 적용
  - 헤더는 앱 환경에서 `safe-area-inset-top`을 반영
  - 하단 고정 CTA, 홈 모바일 CTA, 기사 앱 하단 탭에 `safe-area-inset-bottom` 반영
  - `public/manifest.json` 생성 및 앱 레이아웃 메타 태그 연결
- 관리자 알림 설정을 운영 DB에 추가했다.
  - `admin_email`, `admin_phone`, `notify_channel`
  - 주문 생성/결제 완료 시 `lib/notify-admin.ts`를 통해 관리자 알림 큐 기록
  - Resend 환경변수와 관리자 이메일이 있으면 이메일 발송 시도, 없으면 DB 큐 기록만 수행
- 고객 재방문 유도 기능을 추가했다.
  - 후기 제출 완료 후 관련 서비스 추천 카드 표시
  - 전화번호 기준 이전 이용 이력 조회 API `GET /api/orders?phone=...` 추가
  - 견적 페이지 고객 정보 입력 시 이전 시공 이력 카드 표시
- A/S 만료 임박 고객 관리를 보강했다.
  - `warranty_period_days`, `warranty_reminder_days` 설정 추가
  - `/admin/analytics`와 `/api/admin/analytics`에 A/S 만료 임박 고객 집계 추가
- 운영 준비 확인 결과:
  - 카카오 채널 URL: placeholder 상태. `/admin/settings`에서 실제 채널 URL 입력 필요
  - 활성 기사 계정: 2명
  - 알림 설정 키: 3개 존재
  - 로컬 관리자 비밀번호는 `.env.local`의 `ADMIN_PASSWORD` 환경변수 사용 확인
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과

## 실서비스 론칭 준비 점검 (2026-05-11)

- 운영 DB 현황을 확인했다.
  - 퍼널 이벤트 기존 저장 확인: `service_card_click`, `quote_page_view`, `order_created`, `payment_started`, `payment_completed`, `diagnosis_requested` 등
  - 최근 주문 상태 분포 확인
  - 활성 기사 계정 2건 확인
- 운영 설정 테이블을 추가했다.
  - `supabase/migrations/202605110002_app_configs_launch_readiness.sql`
  - `app_configs` 테이블 생성
  - 기본 설정 저장: `kakao_channel_url`, `service_phone`, `slot_cap`, `maintenance_mode`
  - `events.created_at` 컬럼 추가 및 기존 `occurred_at` 기준 백필
- 관리자 설정 화면을 추가했다.
  - `/admin/settings`
  - `app/api/admin/settings/route.ts`
  - 카카오 채널 URL, 대표 전화번호, 슬롯 최대 예약 수, 점검 안내 설정 가능
  - 관리자 사이드바에 `설정` 메뉴 추가
- 공개 화면 설정 연동을 보강했다.
  - `lib/app-config.ts` 추가
  - Root Layout에서 `app_configs` 값을 읽어 카카오 상담 CTA와 점검 안내에 반영
  - placeholder 카카오 URL은 고객 화면에서 비활성 처리
- 퍼널 이벤트를 보강했다.
  - `quote_started`, `quote_submitted` 이벤트 타입 추가
  - `/quote/[serviceCode]` 진입 시 `quote_started` 저장
  - 견적 생성 성공 후 `quote_submitted` 저장
  - 결제 confirm 성공 후 서버에서 `payment_completed` 저장
  - `/api/events`가 `event_type`/`eventType`, `occurred_at`/`occurredAt` 모두 받을 수 있도록 호환성 추가
  - 공개 페이지 전역 `page_view` 트래킹 추가
- 론칭 전 안정화 작업을 적용했다.
  - `app/error.tsx` 한글 500 에러 페이지 추가
  - `next.config.ts` 보안 헤더 추가: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
  - 프로덕션 민감 정보 `console.log`/`console.error` 출력 없음 확인
  - 관리자 기사 배정 API의 `scheduled_at` 검증을 KST 오프셋 형식도 허용하도록 수정
- 운영 API 리허설을 완료했다.
  - 신규 주문 생성: PASS
  - 예약 생성: PASS (`2026-05-14 morning`)
  - 견적 생성: PASS (`total_final = 185000`)
  - 견적 수락: PASS
  - mock Toss 결제 confirm: PASS (`payments.status = done`)
  - 기사 배정: PASS
  - 기사 시공 시작: PASS
  - 기사 시공 완료: PASS
  - 주문 상태 페이지 응답: PASS
  - 테스트 고객 데이터 정리 완료: `010-9999-0001`
- 퍼널 이벤트 최종 저장 확인:
  - `quote_started`
  - `quote_submitted`
  - `payment_started`
  - `payment_completed`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
- Vercel 프로덕션 재배포 완료:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-31kvw44d3-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_C8Vyq9G71HppdBNt1HLxTtGAJv9t`
- 재배포 후 프로덕션 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/request/photo` 200 OK
  - `/orders/[테스트주문ID]` 200 OK
  - `/admin/slots` 200 OK
  - `/admin/diagnoses` 200 OK
  - `/admin/analytics` 200 OK
  - `/admin/technicians` 200 OK
  - `/admin/settings` 200 OK

## 전체 UI/UX 검증 및 수정 (2026-05-11)

- 프로덕션 기준 고객 흐름, 관리자, 기사 앱, 모바일 레이아웃을 점검했다.
- 발견된 UX 문제를 수정했다.
  - 홈 히어로 CTA 추가
  - 푸터 대표 전화 항목 추가
  - 견적 페이지 모바일 슬롯 카드 2열 유지
  - 이전 시공 이력 카드에서 accessToken 없는 주문 링크 제거
  - 관리자 사진 판정 레이아웃 모바일 대응
  - 기사 관리 담당 지역/메모 컬럼과 등록 폼 추가
  - 기사 활성/비활성 토글 API 및 UI 추가
- 운영 DB 마이그레이션 적용:
  - `202605110004_technician_region_note.sql`
- 검증 보고서 생성:
  - `UI_UX_VERIFICATION.md`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - Vercel 프로덕션 재배포 완료
  - 고객/기사/관리자 주요 URL 200 OK 확인

## AI 사진 판정 실연결 + 운영 데이터 검증 (2026-05-11)

- 운영 DB 사전 점검을 진행했다.
  - 최근 7일 주문의 집/가구 맥락 데이터는 대부분 미입력 상태임을 확인
  - 이벤트 트래킹은 2026-05-08 이후 최신 발화 데이터가 부족함을 확인
  - `diagnoses`는 기존 수동 판정 컬럼만 있어 AI 결과 저장 컬럼이 필요함을 확인
- AI 판정 결과 저장 마이그레이션을 추가하고 운영 DB에 적용했다.
  - `supabase/migrations/202605110001_ai_diagnoses_columns.sql`
  - `service_type_code`, `image_urls`, `confidence`, `details`, `recommendation`, `raw_response` 추가
  - `diagnoses.result` 체크 제약을 한국어 결과값까지 허용하도록 확장
- `POST /api/diagnoses`를 실제 AI 판정 흐름으로 교체했다.
  - 업로드된 Storage path를 signed URL로 변환
  - 이미지 접근 가능 여부 확인
  - GPT-4o Vision 호출 구조 추가
  - JSON 파싱 실패 시 `현장확인필요` fallback 처리
  - 결과와 raw response를 `diagnoses`에 저장
- `/request/photo`를 사진 업로드 후 즉시 AI 판정 결과 카드가 표시되는 흐름으로 개선했다.
  - 교체추천 / 교체불필요 / 보류 / 현장확인필요 색상 구분
  - 신뢰도, 판정 근거, 상세 설명, 추천 문구 표시
  - 결과별 CTA 분기 추가
- 사진 판정 요청 성공 시 `diagnosis_requested` 이벤트가 발화되도록 추가했다.
- `/admin/analytics`와 `GET /api/admin/analytics`를 추가했다.
  - 이번 주 신규 주문, 결제 완료, 사진 판정 요청, 결과별 분포, 퍼널 전환 표시
- `/admin/diagnoses` 목록을 AI 판정 결과 운영 화면으로 보강했다.
  - 주문번호, 서비스명, 결과 배지, 신뢰도, 판정 근거, 썸네일 표시
- `.env.example`에 `OPENAI_API_KEY` 항목을 추가했다.
- 환경변수 확인 결과:
  - 로컬 `.env.local`: `OPENAI_API_KEY` 미설정
  - Vercel Production: `OPENAI_API_KEY` 미설정
  - 키 설정 전에는 프로덕션 재배포를 보류해야 함

## AI 사진 판정 Anthropic Claude 전환 (2026-05-11)

- Vercel Production 환경변수에 `ANTHROPIC_API_KEY`가 존재함을 확인했다.
- `@anthropic-ai/sdk` 패키지를 설치했다.
- `.env.example`에 `ANTHROPIC_API_KEY=` 항목을 추가했다.
- `POST /api/diagnoses`의 AI 호출을 OpenAI 방식에서 Anthropic Claude 방식으로 교체했다.
  - 모델: `claude-opus-4-5`
  - 이미지 입력은 서버에서 URL을 fetch 후 base64 이미지 블록으로 변환해 Anthropic에 전달
  - Claude 응답의 JSON 코드블록을 안전하게 추출해 파싱
  - 유효하지 않은 결과값은 `현장확인필요` fallback 처리
- 직접 API 호출에서도 운영 이벤트가 남도록 `diagnosis_requested` 이벤트를 서버에서 기록하도록 보강했다.
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - Vercel Production 재배포 완료
  - `/`, `/request/photo`, `/admin/diagnoses`, `/admin/analytics` 200 OK
  - `POST /api/diagnoses` 201 응답 확인
  - 운영 DB `diagnoses` 저장 확인
  - 운영 DB `events.event_type = diagnosis_requested` 저장 확인
- 참고:
  - 전달받은 Wikimedia 테스트 URL은 원본이 400 응답을 반환해 실검증에는 접근 가능한 대체 이미지 URL을 사용했다.

## 엑셀/gg 문서 기반 UX·데이터 수집 개선 (2026-05-08)

- `빌드어스_데이터수집매뉴얼_v1_2026-05-07.xlsx`와 `gg.html`, `gg2.html`, `gg3.html`을 기준으로 현재 구현을 재검토했다.
- 엑셀 P1 중 바로 수집 가치가 있는 집/가구 맥락 필드를 추가했다.
  - `customers.household_size`
  - `customers.has_kids`
  - `customers.has_elderly`
  - `homes.floor`
  - `homes.complex_id`
- 신규 마이그레이션을 추가했다.
  - `supabase/migrations/202605080011_p1_household_home_context.sql`
- `/quote/[serviceCode]` 집 정보 섹션을 보강했다.
  - 층수, 단지명, 가구 인원, 아이/노약자 여부 입력 추가
  - 주문 생성 API에 해당 값을 함께 전송
- `POST /api/orders`에서 신규 P1 필드를 저장하도록 수정했다.
  - 고객 upsert 시 가구 맥락 저장
  - 집 주소 재사용 시에도 null이 아닌 집 정보만 보강 업데이트
- 홈 화면의 사진 판정 메시지를 `gg3.html` 방향에 맞춰 조정했다.
  - “사진 3장 판정소”
  - “멀쩡한 건 바꾸지 않습니다”
  - 교체추천 / 보류 / 교체불필요 / 현장확인필요 기준 카드 추가
- `/request/photo` 사진 판정 플로우에 고객 부담을 낮추는 안내와 3장 촬영 가이드를 추가했다.
  - 전체 사진
  - 문제 부위
  - 배관·벽·바닥·규격

## 예약 슬롯 실시간 반영 + 관리자 슬롯 운영 UI (2026-05-08)

### 운영 DB 슬롯 현황 확인

- 운영 프로젝트: `rmkjidubdcjqxjywxccr`
- jobs 기준 예약:
  - 2026-05-08 오전 1건
  - 2026-05-12 오전 1건
  - 2026-05-20 오후 1건
  - 2026-05-21 오전 1건 / 오후 1건
  - 2026-05-29 오전 1건
- reservations 기준 확정 예약:
  - 2026-05-08 오전 1건
  - 2026-05-09 오전 1건 / 오후 1건
  - 2026-05-11 오후 1건
  - 2026-05-12 오후 1건
  - 2026-05-14 오전 1건
  - 2026-05-15 오후 1건
  - 2026-05-19 오전 1건
  - 2026-05-21 오후 1건
  - 2026-05-29 오후 1건
- 2026-05-09 오후는 운영 DB 기준 `1/3`이므로 `isFull=false`가 정상이다.

### DB/서버 수정

- `slot_configs`에 관리자 운영용 컬럼을 추가했다.
  - `type`
  - `cap_value`
  - `reason`
  - `target_date`
- 전역 cap row를 추가했다.
  - `date = 0001-01-01`
  - `type = cap`
  - `cap_value = 3`
- `reserve_order_slot` DB 함수를 보강했다.
  - 전역 cap 우선 적용
  - 날짜별 차단 설정 반영
  - `jobs + reservations` 합산으로 슬롯 마감 방어
  - `pg_advisory_xact_lock` 기반 동시 요청 방어 유지
- 배포 후 `/api/slots`에서 enum에 없는 `canceled` 필터로 500이 발생하는 문제를 확인하고, 운영 DB enum 기준인 `cancelled`만 사용하도록 수정했다.

### `/api/slots` 응답 개선

- 날짜별 상세 상태를 추가했다.
  - `date`
  - `allFull`
  - `blocked`
  - `beforeMinDate`
  - `slots.morning.usedCount/maxCount/isFull`
  - `slots.afternoon.usedCount/maxCount/isFull`
- 기존 `slots`, `closed`, `usage` 응답도 하위 호환용으로 유지했다.

### 고객 캘린더 UX 개선

- 날짜 비활성화 기준을 `beforeMinDate OR blocked OR allFull`로 정리했다.
- 로딩 중 날짜/슬롯 버튼 선택을 차단하고 스켈레톤을 표시한다.
- API 실패 시 `날짜를 불러올 수 없습니다. 다시 시도해주세요.`와 재시도 버튼을 표시한다.
- 월 이동 시 이전 달 슬롯 데이터를 즉시 초기화한다.
- 마감 슬롯은 `마감` 배지와 사용량 `n/3`을 표시한다.
- 두 슬롯 모두 마감인 날짜는 날짜 셀에 빨간 점을 표시한다.

### 관리자 슬롯 UI

- `/admin/slots` 페이지를 추가했다.
- 관리자 사이드바에 `슬롯 관리` 메뉴를 추가했다.
- 기능:
  - 월별 슬롯 현황 캘린더
  - 오전/오후 사용량 표시
  - 마감/여유/차단 날짜 시각 구분
  - 날짜 클릭으로 차단/해제
  - 전역 cap 숫자 입력 및 저장
- 신규 API:
  - `GET /api/admin/slot-configs`
  - `POST /api/admin/slot-configs`
  - `DELETE /api/admin/slot-configs/:date`

### UI/UX 보강

- 홈 서비스 카드에 9개 서비스별 한 줄 설명을 추가했다.
- 모바일 홈 서비스 그리드를 3열에서 2열로 조정해 375px에서 카드 폭을 확보했다.
- 신뢰 배지 문구를 실제 운영 데이터 수집/AS/작업 기록 기준으로 정리했다.
- 모바일 헤더에 짧은 `상담` CTA를 노출했다.
- 견적 페이지 상단 스텝을 `정보 입력 → 날짜 선택 → 견적 확인 → 결제`로 정리하고 현재/완료 상태를 표시했다.
- 주소 미입력/이름/전화번호 오류 시 인라인 오류와 스크롤 이동을 추가했다.
- 주소 입력 완료 시 `입력 완료 ✓`를 표시한다.

### 검증 결과

- `npm run typecheck` 통과
- `npm run build` 통과
- Vercel 프로덕션 배포 완료
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-twkvczm9m-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_Sq12gbCTGqxoqDfc4y45tMqFjvci`
- 재배포 후 프로덕션 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/slots` 로그인 리다이렉트 후 200 OK
- `/api/slots?year=2026&month=5` 확인:
  - `2026-05-09 morning`: `usedCount=1`, `isFull=false`
  - `2026-05-09 afternoon`: `usedCount=1`, `isFull=false`
  - `effectiveMaxSlotsPerPeriod=3`

## Phase 2: 고객 여정 이벤트 트래킹 (2026-05-08)

- 운영 DB에 `202605080004_events_tracking.sql` 마이그레이션을 적용했다.
  - `events` 퍼널 이벤트 테이블 추가
  - `customers.utm_source`, `utm_campaign`, `utm_medium`, `referrer_url` 컬럼 추가
  - `events` RLS + FORCE RLS + service role 정책 적용
- 이벤트 타입과 클라이언트 트래킹 유틸을 추가했다.
  - `lib/event-types.ts`
  - `lib/tracking.ts`
  - `lib/use-tracking.ts`
- 공개 이벤트 수집 API를 추가했다.
  - `POST /api/events`
  - IP 기준 분당 60건 rate limit
  - `order_id`가 있으면 주문의 `customer_id` 자동 연결
  - 클라이언트 `occurred_at`은 받지 않고 서버 시각으로 기록
- 주문 생성 시 UTM 값을 DB에 저장하도록 연결했다.
  - `/api/orders`에서 `utm_source`, `utm_campaign`, `utm_medium`, `referrer_url` 저장
  - 기존 고객은 새 UTM 값이 들어온 경우에만 덮어쓰기
- 주요 고객 여정 이벤트 발화를 연결했다.
  - 홈 서비스 카드 클릭: `service_card_click`
  - 견적 페이지 진입: `quote_page_view`
  - 사진 업로드: `photo_uploaded`
  - 주소 입력: `address_entered`
  - 예약일/슬롯 선택: `date_selected`
  - 주문 생성: `order_created`
  - 견적 수락: `quote_accepted`
  - 결제 시작/완료/실패: `payment_started`, `payment_completed`, `payment_failed`
  - 후기/A/S 접수: `feedback_submitted`, `warranty_submitted`
- 관리자 퍼널 분석 화면을 추가했다.
  - `GET /api/admin/funnel`
  - `/admin/funnel`
  - 관리자 사이드바 `퍼널 분석` 메뉴 추가
  - 최근 7일/30일 전체 퍼널 및 채널별 퍼널 표시
- 검증 결과:
  - `phase2_events_checks.sql`: `events_table_exists = 1`
  - `phase2_events_checks.sql`: `utm_columns_exist = 4`
  - 신규 이벤트 적재 전이라 `events_by_type`은 빈 결과
  - `utm_captured_count = 0` (신규 UTM 주문 발생 전)
  - `npm run typecheck` 통과
  - `npm run build` 통과
- Vercel 프로덕션 배포 완료:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-oys5u9fm0-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_2AZr2Vo6nyu15rWXXb6zFHnLyeRf`
- 재배포 후 프로덕션 응답 확인:
  - `/` 200 OK
  - `/admin/login` 200 OK
  - `POST /api/events` 201 OK
- 프로덕션 이벤트 적재 확인:
  - 테스트 이벤트 ID: `6faa006c-b17c-4674-87bb-c2153c5d2034`
  - `events_by_type`: `page_view = 1`

## Phase 2: 예약 슬롯 중복 방지 + 응답 속도 개선 (2026-05-08)

- 슬롯 설정 마이그레이션을 적용했다.
  - `202605080005_slots_config.sql`
  - `slot_configs` 테이블 추가
  - RLS + FORCE RLS + service role 정책 적용
  - 기존 `reservations_confirmed_slot_uq` 단일 슬롯 유니크 인덱스 제거
  - `idx_reservations_date_slot_status` 인덱스 추가
- 공개 슬롯 조회 API를 추가했다.
  - `GET /api/slots?year=YYYY&month=M`
  - `MAX_SLOTS_PER_PERIOD` 기본값 3
  - `jobs.scheduled_at`과 `reservations` 확정 건을 함께 집계
  - 오전/오후 슬롯별 사용량과 마감 여부 반환
  - 오늘 포함 D+1 이전 날짜는 선택 불가 처리
- 예약 생성 API에 서버 측 슬롯 마감 검증을 추가했다.
  - `/api/orders/:id/reservation`
  - 슬롯 cap 초과 시 `409 SLOT_FULL`
  - 날짜 차단 시 `409 SLOT_CLOSED`
- 견적 상세 페이지 캘린더를 슬롯 API와 연결했다.
  - 월 이동 시 `/api/slots` 재조회
  - 두 슬롯 모두 마감이면 날짜 선택 비활성화
  - 특정 슬롯만 마감이면 해당 슬롯 카드 비활성화 + `마감` 배지 표시
- 응답 속도 개선을 일부 적용했다.
  - `GET /api/slots`: 60초 revalidate
  - `GET /api/cases`: 300초 revalidate
  - `GET /api/admin/stats`: 30초 revalidate
  - `GET /api/admin/funnel`: 300초 revalidate
- 검증 결과:
  - `phase2_slots_checks.sql`: `slot_configs_table_exists = 1`
  - `phase2_slots_checks.sql`: `reservations_slot_unique_removed = 0`
  - `phase2_slots_checks.sql`: `rowsecurity = true`, `forcerowsecurity = true`
  - `phase2_slots_checks.sql`: `slot_configs_policy_count = 1`
  - `npm run typecheck` 통과
  - `npm run build` 통과
- Vercel 프로덕션 배포 완료:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-i7zsmpz4e-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_QR8aqDAkqhfcuoCj9Z9hjv4jCtbw`
- 재배포 후 프로덕션 응답 확인:
  - `/quote/toilet_replace` 200 OK
  - `/api/slots?year=2026&month=6` 200 OK
  - `maxSlotsPerPeriod = 3`

## Phase 2: 예약 슬롯 UX 전면 검증 및 동시성 방어 보강 (2026-05-08)

- 요청된 운영 DB 마이그레이션 3개를 순서대로 재적용하고 즉시 검증했다.
  - `202605080003_technician_access_token.sql`: `technician_access_token_col = 1`
  - `202605080004_events_tracking.sql`: `events_table = 1`, `utm_columns = 4`
  - `202605080005_slots_config.sql`: `slot_configs_table = 1`, `old_unique_removed = 0`, `rowsecurity = true`, `forcerowsecurity = true`
- 운영 DB 슬롯 현황을 직접 조회했다.
  - `jobs.scheduled_at` 기준 예약 건수 확인
  - `reservations.status = confirmed` 기준 예약 건수 확인
  - 기본 cap 3을 초과한 슬롯 없음
- `/api/slots` 응답 구조를 보강했다.
  - 기존 `slots`, `closed`, `usage` 유지
  - 신규 `days[date].slots[period].isFull`
  - 신규 `days[date].slots[period].available`
  - 신규 `days[date].blocked`, `beforeMinDate`
- 캘린더 UX 문제 원인을 수정했다.
  - 원인 1: API 응답에 명시적인 `isFull` 구조가 없어 UI가 available 배열에 의존
  - 원인 2: 초기 렌더링에서 슬롯 API 도착 전 기본값으로 오전/오후가 선택 가능하게 보일 수 있음
  - 수정: 슬롯 데이터 로딩 전에는 날짜/슬롯 선택을 비활성화하고, 응답 도착 후에만 선택 가능 처리
  - 월 이동 시 `calendarMonth` 변경에 따라 `/api/slots` 재조회 유지
- 예약 생성 서버 방어를 강화했다.
  - `202605080006_reservation_slot_guard.sql` 추가
  - `reserve_order_slot` Postgres 함수 추가
  - `pg_advisory_xact_lock`으로 같은 날짜/슬롯 동시 요청을 직렬화
  - `jobs.scheduled_at` + `reservations.confirmed` 양쪽을 합산해 cap 검사
  - cap 초과 시 `SLOT_FULL`
  - 차단 날짜는 `SLOT_CLOSED`
- 검증 SQL을 추가하고 실행했다.
  - `supabase/verification/phase2_slots_ux_checks.sql`
  - `over_cap_slots`: 없음
  - `blocked_slot_config_dates`: 없음
  - `confirmed_before_min_date = 1` (기존 과거 confirmed 예약 1건)
  - `reservation_slot_guard_function = 1`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
- Vercel 프로덕션 배포 완료:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-gj8f9fexq-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_Cg9vAehiQFjiV8YzqPJyLe5xtxgd`
- 재배포 후 프로덕션 응답 확인:
  - `/quote/toilet_replace` 200 OK
  - `/api/slots?year=2026&month=5` 200 OK
  - `days.*.slots.*.isFull` 응답 포함 확인
- 프로덕션 배포:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-layfm8txe-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_8BeMGSFUdp9Mxb8hig39qjCzKa1J`
- 배포 후 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/login` 200 OK

## Phase 2-C: lazyweb 레퍼런스 기반 UI 리디자인 (2026-05-08)

- `.lazyweb/buildus-ui-refactor-2026-05-08` 레퍼런스 25개를 확인했다.
  - 메타데이터: `lazyweb-results.json`
  - 스크린샷: `references/`
- 직접 참고한 주요 레퍼런스:
  - Taskrabbit property rental services: 서비스 목록 + 우측 예약 흐름 안내
  - Drumroll checkout: 폼 입력 영역 + Order Summary 구조
  - Microsoft order tracking: 큰 주문 상태 요약 블록 + 신뢰/혜택 카드
- `/` 홈 개선:
  - 서비스 카드 그리드 오른쪽에 예약 안내 패널 추가
  - 작업 선택 → 사진·주소 확인 → 결제 후 예약 흐름을 명확히 표시
  - 후기 신뢰 문구를 예약 안내 패널 하단에 추가
- `/quote/[serviceCode]` 개선:
  - 결제 하단 고정 CTA 영역에 주문 요약 카드 추가
  - 가격 카드에 `Order Summary` 라벨 추가
  - 입력 중인 섹션에 focus 강조를 추가해 폼 흐름을 더 명확하게 처리
- `/orders/[id]` 개선:
  - 주문 헤더와 타임라인 사이에 현재 진행 상태 요약 패널 추가
  - 서비스, 결제 금액, 방문 일정을 타임라인 전에 먼저 요약
  - 고객이 링크 진입 직후 현재 상태를 바로 이해하도록 정보 계층 조정
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
- Vercel Production 환경변수 등록:
  - `NEXT_PUBLIC_TOSS_CLIENT_KEY`
  - `TOSS_SECRET_KEY`
  - `TOSS_WEBHOOK_SECRET`
  - `PAYMENT_MOCK_MODE=false`
- 프로덕션 배포:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-4567hj1yv-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_4mSiW4rZy17NWgGRdDxN4PwjA6YW`
- 프로덕션 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/login` 200 OK

## Phase 2-B: UI 마감 + 관리자 대시보드 마감 (2026-05-08)

- `lib/format.ts` 공통 포맷 유틸을 추가했다.
  - `formatServiceName`
  - `formatOrderStatus`
  - `formatKRW`
  - `formatKRDate`
  - `formatKRDateTime`
- 서비스명 한글화 매핑을 추가했다.
  - `toilet_replace` → `변기 교체`
  - `faucet_replace` → `수전 교체`
  - `light_replace` → `조명 교체`
  - `outlet_replace` → `콘센트 교체`
  - `door_handle` → `문 손잡이 교체`
  - `bidet_install` → `비데 설치`
  - `ventilator_replace` → `환풍기 교체`
  - `drain_clog` → `하수구 막힘`
  - `partial_wallpaper` → `부분 도배`
- 주문 상태 페이지 문구를 정돈했다.
  - 서비스 코드 대신 한글 서비스명 표시
  - 견적 버전 `v1` 대신 `1차 견적` 표시
  - 견적 기준일을 한국어 날짜 포맷으로 통일
  - 결제 버튼 하단에 “결제 완료 후 담당자가 직접 연락드립니다” 안내 추가
- 관리자 주문 목록을 정돈했다.
  - 서비스명 한글화
  - 상태 배지 한글화
  - 채널 배지 한글화
  - 금액/날짜 포맷 통일
- 관리자 주문 상세를 정돈했다.
  - 고객/주소 원본 표시 유지
  - 주거형태/건물유형/평수/준공연도 한글 표시 보강
  - 견적 금액 한국 통화 포맷 표시
  - 결제 정보 카드 추가
- 관리자 현장 관리 화면을 정돈했다.
  - 서비스명/상태 한글화
  - 등록된 기사가 없을 때 안내 메시지 표시
  - 현장 상세 방문 예정일 한국어 날짜+시간 표시
- 관리자 KPI 날짜 기준을 한국 시간 기준으로 보정했다.
- 운영 DB 직접 확인:
  - 오늘 신규 주문: 7건
  - 오늘 결제 완료: 2건
  - 이번 주 매출: 1,648,000원
  - 판정 대기: 2건
  - 최신 주문: `BO-20260508-0007`, 상태 `paid`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - `/quote/toilet_replace?region=suwon&source=kakao&product=premium&addons=angle_valve,bidet_hose&campaign=faucet_price` 200 렌더링 확인
  - 배너/서비스명/고급 자재/addon/총 예상 금액 렌더링 확인
- 참고:
  - 현재 Step 3 결제 정책은 accepted quote의 `total_final`만 confirm 가능하다.
  - 예약금 30,000원 분할 결제는 별도 결제 정책 확장이 필요하므로 UI에서는 안내 후 전액 결제 테스트를 유도한다.

### `/` 홈 페이지

- 한국형 집수리 견적 웹앱 홈을 신규 구현했다.
- 신규/수정 파일:
  - `app/page.tsx`
  - `app/home-client.tsx`
  - `app/request/photo/page.tsx`
  - `components/home/ServiceCard.tsx`
  - `components/home/TrustBadges.tsx`
  - `components/home/CaseSamples.tsx`
  - `components/home/BottomCTA.tsx`
  - `lib/service-items.ts`
- 홈 구성:
  - 히어로: "무엇을 교체하거나 수리할까요?"
  - 검색바 기반 실시간 서비스 필터링
  - 작업 카드 9개 렌더링
  - 사진 판정 배너
  - 실제 가격 사례 3건
  - 신뢰 배지 4개
  - 카톡 상담 배너
  - 모바일 전용 하단 고정 CTA
- 홈 작업 카드는 아래 9개로 고정했다.
  - `toilet_replace`
  - `faucet_replace`
  - `light_replace`
  - `outlet_replace`
  - `door_handle`
  - `bidet_install`
  - `ventilator_replace`
  - `drain_clog`
  - `partial_wallpaper`
- 홈 진입 URL의 `source`, `campaign`, `region`을 `sessionStorage`에 보관하고, 카드 클릭 시 `/quote/[serviceCode]` URL에 전달한다.
- `/request/photo`는 diagnoses 스키마가 아직 없으므로 "준비 중" 페이지로 연결만 추가했다.
- 홈 서비스 시드 보강 마이그레이션 추가 및 테스트 DB 적용:
  - `supabase/migrations/202605070010_home_service_items.sql`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - 로컬 dev 서버 `/` 200 응답 확인
  - 히어로/변기 교체/수전 교체/하수구 막힘/사진 판정/정찰가 보장/카톡 상담 문구 렌더링 확인

### 카톡 링크 비활성화, 주소 모달, 캘린더, 주문 상태 페이지

- 카톡 상담 URL을 `lib/config.ts`의 `KAKAO_CHANNEL_URL`로 분리했다.
- `.env.local`에 `NEXT_PUBLIC_KAKAO_CHANNEL_URL=` 빈 값을 추가했다.
- 홈과 견적 상세의 카톡 CTA는 URL이 없으면 비활성화 상태와 "카톡 상담 채널 준비 중" 문구를 표시한다.
- 홈코 링크 하드코딩 참조를 제거했다.
- `/quote/[serviceCode]` 주소 입력을 인라인 embed에서 모달 방식으로 변경했다.
  - `components/common/AddressModal.tsx`
  - 배경 클릭/ESC 닫기
  - 주소 선택 완료 시 자동 닫기
  - 도로명 주소와 상세주소 입력을 분리 표시
- `/quote/[serviceCode]` 예약 캘린더를 개선했다.
  - 오늘은 원형 테두리만 표시
  - 지난 날짜와 오늘은 비활성화
  - D+1부터 선택 가능
  - 이전/다음 월 이동
  - 날짜 선택 후 오전/오후 슬롯 카드 노출
  - 선택 슬롯 체크 표시
- `/api/orders/:id/status`를 고객 상태 페이지용으로 보강했다.
  - `Authorization: Bearer <accessToken>` 지원
  - `skus`, `service_type_code` 포함
  - `media`, `feedbacks` 포함
  - media signed URL 생성
- `/orders/[id]`를 실제 데이터 연동 상태 페이지로 교체했다.
  - `app/orders/[id]/page.tsx`
  - `app/orders/[id]/order-status-client.tsx`
  - `components/orders/StatusTimeline.tsx`
  - `components/orders/QuoteSummary.tsx`
  - `components/orders/ReservationCard.tsx`
  - `components/orders/FeedbackModal.tsx`
- 주문 상태 페이지 구성:
  - 주문 헤더
  - 9단계 세로 타임라인
  - 견적서 카드
  - 예약 정보 카드
  - 완료 후 after 사진
  - 완료/시공완료 후 후기 작성 모달
  - 완료 후 A/S CTA
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - 로컬 dev 서버 `/` 200 응답 확인
  - 로컬 dev 서버 `/quote/toilet_replace` 200 응답 확인
  - 로컬 dev 서버 `/orders/00000000-0000-0000-0000-000000000000` 200 응답 확인

### UI 디자인 시스템 리디자인 + `/request/photo`

- 전역 디자인 토큰을 추가했다.
  - `app/globals.css`
  - 베이지 배경, 흰 카드, 프라이머리 그린, Pretendard 기반 토큰
- `app/layout.tsx`에 Pretendard CDN stylesheet를 추가했다.
- `lucide-react` 의존성을 추가하고 홈 이모지 아이콘을 lucide 아이콘으로 교체했다.
- 홈 UI 리디자인:
  - 히어로 문구를 "교체·수리, 지금 바로 예약하세요"로 변경
  - 검색바 돋보기 아이콘 추가
  - 서비스 카드 hover shadow/translate 적용
  - 사진 판정 배너 문구/스타일 변경
  - 신뢰 배지 2x2/4열 대응 + lucide 아이콘 적용
  - 실제 시공 사례 카드 스타일 변경
  - 모바일 하단 CTA blur/primary/outline 스타일 적용
- `/quote/[serviceCode]` UI 리디자인:
  - 컨텍스트 배너에 MessageCircle 아이콘 적용
  - 가격 카드 토큰 기반 스타일 보강
  - 포함/불포함 항목 아이콘 적용
  - addon 선택 카드 강조 스타일 적용
  - 사진 업로드 3슬롯 썸네일/삭제 버튼 구조로 변경
  - 주소 입력 버튼에 MapPin 아이콘과 토큰 스타일 적용
  - primary CTA 토큰 스타일 적용
- `/orders/[id]` UI 리디자인:
  - 카드 공통 스타일 토큰 적용
  - 타임라인 완료/현재/미래 상태 스타일 구분
  - 완료 연결선 primary 색상 적용
  - 현재 단계 pulse dot 적용
- 사진 판정 기능 추가:
  - `supabase/migrations/202605070011_diagnoses.sql`
  - `app/api/storage/upload-temp/route.ts`
  - `app/api/diagnoses/route.ts`
  - `app/api/diagnoses/[id]/route.ts`
  - `app/request/photo/page.tsx`
  - `app/request/photo/photo-request-client.tsx`
  - `app/request/photo/result/page.tsx`
  - `app/request/photo/result/photo-result-client.tsx`
- `/request/photo` 구성:
  - ① 작업 선택
  - ② 사진 올리기
  - ③ 연락처
  - ④ 완료
- `/request/photo/result`는 5초 간격 polling으로 pending/result 상태를 표시한다.
- diagnoses 마이그레이션을 테스트 DB에 적용했다.
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - `POST /api/diagnoses` 생성 성공
  - `GET /api/diagnoses/:id` pending 응답 확인
  - `POST /api/storage/upload-temp` signed upload URL 생성 확인
  - 로컬 dev 서버 `/`, `/quote/toilet_replace`, `/orders/:id`, `/request/photo`, `/request/photo/result?id=...` 200 응답 확인

### 글로벌 네비게이션 + `/services`

- 전역 레이아웃에 Header/Footer를 추가했다.
  - `components/layout/Header.tsx`
  - `components/layout/Footer.tsx`
  - `app/layout.tsx`
- Header 구성:
  - buildus care 로고
  - 데스크톱 중앙 메뉴: 서비스, 시공 사례, 사진 판정
  - 데스크톱 CTA: 사진으로 견적받기, 카톡 상담
  - 모바일 햄버거 메뉴
  - `usePathname` 기반 현재 경로 활성화
  - `KAKAO_CHANNEL_URL`이 없으면 카톡 상담 CTA 비활성화
- Footer 구성:
  - 로고
  - 사업자 정보 placeholder
  - 서비스/시공 사례/사진 판정 링크
  - copyright
- `/services` 서비스 목록 페이지를 추가했다.
  - `app/services/page.tsx`
  - `app/services/services-client.tsx`
- `/services` 구성:
  - 페이지 헤더
  - 카테고리 탭 필터
  - 서비스 상세 카드 9개
  - 하단 사진 판정/카톡 상담 배너
  - 카드 클릭 시 `/quote/[serviceCode]` 이동
- `/cases`는 네비게이션 연결을 위해 준비 중 placeholder 페이지를 추가했다.
  - `app/cases/page.tsx`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - 로컬 dev 서버 `/`, `/services`, `/quote/toilet_replace` 200 응답 확인
  - Header 로고/서비스 메뉴 렌더링 확인
  - `/services` 카테고리 탭 렌더링 확인
  - `/services` quote href 9개 확인

### 관리자 페이지 + 배포 준비

- 관리자 인증을 추가했다.
  - `middleware.ts`
  - `/admin` 경로 쿠키 보호
  - `/admin/login`은 공개 접근 허용
  - `admin_session` 쿠키 기반 API 인증도 허용
- 관리자 로그인/로그아웃 API를 추가했다.
  - `app/api/admin/auth/route.ts`
  - `app/api/admin/logout/route.ts`
- 환경변수 항목을 추가했다.
  - `.env.local`: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
  - `.env.example`: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
- 관리자 전용 레이아웃을 추가했다.
  - `app/admin/layout.tsx`
  - `app/admin/admin-shell.tsx`
  - 데스크톱 사이드바, 모바일 상단 탭 구조
- 관리자 대시보드를 추가했다.
  - `app/admin/page.tsx`
  - KPI 4개
  - 오늘 일정
  - 최근 주문 5건
  - `app/api/admin/stats/route.ts`
- 관리자 주문 목록/상세를 추가했다.
  - `app/admin/orders/page.tsx`
  - `app/admin/orders/[id]/page.tsx`
  - 기존 `GET /api/admin/orders`에 필터 파라미터를 보강했다.
- 관리자 현장 관리 화면을 추가했다.
  - `app/admin/jobs/page.tsx`
  - `app/admin/jobs/[id]/page.tsx`
  - `app/admin/jobs/jobs-client.tsx`
  - 시작/완료/검수 액션 연결
- 관리자 사진 판정 화면과 PATCH API를 추가했다.
  - `app/admin/diagnoses/page.tsx`
  - `app/admin/diagnoses/diagnoses-client.tsx`
  - `app/api/admin/diagnoses/[id]/route.ts`
- 관리자 기사 관리 화면과 API를 추가했다.
  - `app/admin/technicians/page.tsx`
  - `app/admin/technicians/technicians-client.tsx`
  - `app/api/admin/technicians/route.ts`
- 배포 준비 파일을 추가했다.
  - `app/not-found.tsx`
  - `app/robots.ts`
  - `app/sitemap.ts`
- 메타데이터를 Buildus Care 서비스용 OG/title/description으로 수정했다.
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - `/admin`, `/admin/login`, `/admin/orders`, `/admin/jobs`, `/admin/diagnoses`, `/admin/technicians` 빌드 라우트 생성 확인
  - `/robots.txt`, `/sitemap.xml` 빌드 라우트 생성 확인

### 관리자 페이지 런타임 오류 수정

- `/admin` 진입 시 `Cannot find module './1331.js'` 런타임 오류를 확인했다.
- 원인:
  - `next build` 이후 기존 dev 서버가 오래된 `.next` 서버 청크를 물고 있는 상태였다.
  - 일부 관리자 데이터 페이지가 명시적으로 동적 렌더링 처리되지 않아 dev/build 전환 시 청크 불일치가 재발할 여지가 있었다.
- 수정:
  - 관리자 데이터 페이지를 `force-dynamic`으로 고정했다.
    - `app/admin/jobs/[id]/page.tsx`
    - `app/admin/diagnoses/page.tsx`
    - `app/admin/technicians/page.tsx`
  - 기존 `.next` 캐시를 삭제하고, 포트 3000을 점유하던 stale dev 프로세스를 종료한 뒤 Next dev 서버를 새로 시작했다.
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - 빌드 출력에서 `/admin` 계열 주요 페이지가 `ƒ Dynamic`으로 생성됨 확인
  - 로컬 dev 서버 재시작 후 `/admin/login` 200 확인
  - 쿠키 없는 `/admin` 접근은 `/admin/login`으로 redirect 확인
  - dev 로그에서 `/admin`, `/admin/orders`, `/admin/jobs`, `/admin/diagnoses` 200 응답 확인

### 관리자 데이터 수집 강화 + CSS 시스템 정비

- 관리자 공통 CSS를 추가했다.
  - `app/admin/admin.css`
  - `adm-shell`, `adm-card`, `adm-table`, `adm-badge`, `adm-btn`, `adm-modal`, `adm-photo-grid` 등 공통 클래스 체계로 통합
  - `app/admin/layout.tsx`에서 공통 CSS를 import
- 관리자 페이지의 인라인 스타일을 제거하고 `adm-*` 클래스 기반으로 정리했다.
  - `app/admin/admin-shell.tsx`
  - `app/admin/page.tsx`
  - `app/admin/orders/page.tsx`
  - `app/admin/orders/[id]/page.tsx`
  - `app/admin/jobs/page.tsx`
  - `app/admin/jobs/[id]/page.tsx`
  - `app/admin/jobs/jobs-client.tsx`
  - `app/admin/diagnoses/page.tsx`
  - `app/admin/diagnoses/diagnoses-client.tsx`
  - `app/admin/technicians/page.tsx`
  - `app/admin/technicians/technicians-client.tsx`
  - `app/admin/login/page.tsx`
- 대시보드 KPI를 8개로 확장했다.
  - 오늘 신규 주문
  - 오늘 결제 완료
  - 이번 주 매출
  - 판정 대기
  - 평균 NPS
  - 견적 미수락
  - 이슈 건수
  - 이번 주 시공 완료
  - `GET /api/admin/stats` 응답도 동일하게 확장
- 주문 목록 필터를 보강했다.
  - `channel`
  - `acquisition_source`
  - `urgency`
  - 채널 배지 표시
- 주문 상세에서 엑셀 P0 수집 필드를 더 노출했다.
  - 고객 유입 출처
  - 주거 유형
  - 건물 유형
  - 준공연도
  - 평수
  - 주문 채널
  - 의뢰 사유
  - 긴급도
  - `orders.skus`
  - 고객 후기/NPS/5축 점수
- 현장 관리 수집 필드를 보강했다.
  - 시작 모달에서 `expected_minutes` 저장
  - 완료 모달에서 `actual_minutes`, `materials_used`, `extra_materials`, `completion_notes`, `issues` 저장
  - 검수 모달에서 `checklist_results`, `passed`, `inspector_note` 저장
  - 현장 상세에서 before/during/after/material/issue 사진 업로드 액션 제공
- 기사 관리 수집 필드를 보강했다.
  - `grade`
  - 복수 담당 서비스 `skills`
  - 평균 NPS, 검수 통과율, 이번 달 건수, 활성 상태 표시
- 사진 판정 관리자 화면을 보강했다.
  - 사진 목록 표시
  - 결과 배지 색상
  - API에서 `replacement_recommended`, `not_needed` 별칭 입력도 기존 DB 코드로 매핑
- 배포 환경변수 예시를 보강했다.
  - `NEXT_PUBLIC_TOSS_CLIENT_KEY`
  - `NEXT_PUBLIC_KAKAO_CHANNEL_URL`
  - `NEXT_PUBLIC_STORAGE_URL`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - 빌드 후 stale `.next` 제거 및 dev 서버 재시작
  - `/admin/login` 200 확인
  - 쿠키 없는 `/admin` 접근은 `/admin/login`으로 307 redirect 확인

### Vercel 프로덕션 배포

- Vercel Production 배포를 완료했다.
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-33r0yf1iq-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_C3GaGeM1XV7e1X7hZ4Qi2LiLor6a`
- 배포 후 프로덕션 검증:
  - `/` 200 OK
  - `/services` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/login` 200 OK
  - 쿠키 없는 `/admin` 접근은 `/admin/login`으로 307 redirect
- 배포 보고서를 추가했다.
  - `phase1-deployment-report.md`
- 보안 정책상 로컬 `.env.local`의 비밀값은 Vercel에 자동 업로드하지 않았다.
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
  - `NEXT_PUBLIC_TOSS_CLIENT_KEY`
  - `TOSS_SECRET_KEY`
  - `NEXT_PUBLIC_KAKAO_CHANNEL_URL`
  - `NEXT_PUBLIC_STORAGE_URL`
  - `DATABASE_URL`
  - 위 항목은 Vercel 대시보드에서 직접 입력 필요

### 집 정보 수집 + 피드백 5축 분리 보강

- `/quote/[serviceCode]` 견적 상세 폼에 집 정보 입력 섹션을 추가했다.
  - 주거 형태: 자가/전세/월세/기타
  - 건물 유형: 아파트/빌라/단독주택/오피스텔
  - 평수
  - 준공 연도
- 화면 한글값은 기존 DB enum에 맞춰 저장한다.
  - 자가 → `owner`
  - 전세 → `jeonse`
  - 월세 → `monthly_rent`
  - 기타 → `unknown`
  - 아파트/빌라/단독주택/오피스텔 → `apartment`/`villa`/`house`/`officetel`
- `POST /api/orders`에서 기존 집을 재사용할 때도 새로 입력한 집 정보가 있으면 `homes` row를 보강 업데이트하도록 수정했다.
- `customers.housing_type` 저장 흐름을 견적 폼 입력값과 연결했다.
- `feedbacks` 5축 점수 컬럼 보강 마이그레이션을 추가했다.
  - `supabase/migrations/202605080001_feedbacks_score_columns.sql`
  - `score_time`
  - `score_quality`
  - `score_response`
  - `score_clean`
  - `score_price`
  - `would_recommend`
  - `would_repurchase`
- 기존 `feedbacks.categories` JSON은 하위 호환을 위해 유지하고, 새 `score_*` 컬럼에도 동시에 저장하도록 `POST /api/orders/:id/feedback`를 수정했다.
- 주문 상태 페이지 후기 모달에 재의뢰/추천 의사 체크박스를 추가했다.
- Toss 공개 키가 없을 때 `/quote/[serviceCode]` 결제 버튼이 런타임 오류를 내지 않도록 비활성화 처리했다.
  - 버튼 문구: `결제 준비 중`
  - 안내 문구: `결제 기능은 곧 연결됩니다. 지금은 카톡 상담으로 예약 가능합니다.`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - 테스트 DB에 `202605080001_feedbacks_score_columns.sql` 적용 성공

### 2026-05-08 Phase 1 마무리 배포

- 주소 파싱 유틸을 추가했다.
  - `lib/address-parse.ts`
  - `parseAddressDong(addressFull)`
  - `parseAddressApt(addressFull)`
- `POST /api/orders`에서 주소 문자열 기반으로 `customers.address_dong`, `customers.address_apt`를 더 정확히 저장하도록 보강했다.
- 고객 의뢰 사진 업로드 후 `media` 저장과 함께 `orders.inquiry_photos`에도 파일 경로 스냅샷을 저장하도록 연결했다.
- 피드백 NPS를 P0 필수값으로 복원했다.
  - NPS 누락 시 `NPS_REQUIRED`
  - 범위 오류 시 `NPS_INVALID`
  - 후기 모달에서도 NPS 입력 전 제출 버튼 비활성화
- A/S 신고 API와 고객 상태 페이지 모달을 추가했다.
  - `POST /api/orders/:id/warranty`
  - `warranty_cases` row 생성
  - 완료 주문만 접수 가능
  - 접수 후 `orders.status = warranty`
- A/S 접수용 마이그레이션을 추가했다.
  - `supabase/migrations/202605080002_warranty_cases_fields.sql`
  - `order_status`에 `warranty` 추가
  - `warranty_cases.issue_type`, `description`, `responsibility` 추가
- 테스트 DB 마이그레이션 적용:
  - `202605080001_feedbacks_score_columns.sql`
  - `202605080002_warranty_cases_fields.sql`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - Vercel 프로덕션 배포 성공
- 배포 정보:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-5xyy12wyx-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_2Kuf2WSmcfzuAAb3446sD5u7ffWa`
- 프로덕션 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/login` 200 OK

### 운영 DB 마이그레이션 적용 완료 (2026-05-08)

- Supabase MCP 연결 프로젝트를 확인했다.
  - project ref: `rmkjidubdcjqxjywxccr`
  - project name: `jun-c0de's Project`
  - region: `ap-northeast-1`
- 운영 DB 현재 테이블 상태를 확인했다.
  - Phase 1 핵심 테이블 존재 확인: `homes`, `quotes`, `media`, `feedbacks`, `inspections`, `warranty_cases`, `technicians`, `materials`
  - `diagnoses`, `service_items` 존재 확인
  - 레거시 테이블 `order_photos`, `reviews`, `addresses`, `order_items`는 이미 없음
- MCP로 적용/기록한 마이그레이션:
  - `202605070001_phase1_foundation`
  - `202605070002_phase1_existing_table_expansion`
  - `202605070004_phase1_indexes_rls`
  - `202605070008_phase1_drop_legacy_tables`
  - `202605070011_diagnoses`
  - `202605080001_feedbacks_score_columns`
  - `202605080002_warranty_cases_fields`
- `202605070003_phase1_data_backfill`는 원본 레거시 테이블이 이미 삭제된 상태라 재실행하지 않았다.
  - 현재 `order_photos`, `reviews` 테이블 없음
  - `media_order_count = 4`
  - `feedbacks_count = 2`
- `service_items` 시드는 운영 DB에 이미 존재함을 확인했다.
  - 핵심 서비스 9개 포함: `toilet_replace`, `faucet_replace`, `light_replace`, `outlet_replace`, `door_handle`, `bidet_install`, `ventilator_replace`, `drain_clog`, `partial_wallpaper`
- RLS/FORCE RLS 검증:
  - 8개 핵심 테이블 모두 `rowsecurity = true`
  - 8개 핵심 테이블 모두 `force_rowsecurity = true`
  - service role 전용 정책 확인
- 프로덕션 주문 생성 E2E 검증:
  - 생성 주문번호: `BO-20260508-0001`
  - 생성 주문 ID: `b66f8263-3ee4-42ee-a4ab-71755894dba7`
  - 고객용 상태 조회 성공
  - 고객명/전화번호/주소 마스킹 확인
  - DB 직접 확인:
    - `address_dong = 영통동`
    - `address_apt = 황골마을현대1단지`
    - `building_type = apartment`
    - `size_pyung = 24`
    - `year_built = 1995`
    - `status = inquiry`
    - `channel = web`
- 운영 DB 마이그레이션 후 Vercel 프로덕션 재배포를 완료했다.
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-36yj0ppqi-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_33gC7ZDJaQED7fxXh9USG7QXdXPb`
- 재배포 후 프로덕션 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/login` 200 OK
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과

### Lazyweb MCP 레퍼런스 수집 + UI 보강 (2026-05-08)

- Lazyweb 플러그인 설치를 시도했으나 현재 Codex 세션에 `lazyweb_*` 도구가 바로 노출되지 않아, Lazyweb MCP JSON-RPC 엔드포인트를 직접 호출해 레퍼런스를 수집했다.
- 수집 쿼리:
  - `home repair service booking flow`
  - `service quote pricing page checkout`
  - `order status tracking timeline`
  - `field service management admin dashboard`
  - `Korean home service app onboarding`
- 수집 결과:
  - 총 25개 레퍼런스 수집
  - 원본 JSON: `.lazyweb/buildus-ui-refactor-2026-05-08/lazyweb-results.json`
  - 스크린샷 저장: `.lazyweb/buildus-ui-refactor-2026-05-08/references/`
- 적용 화면:
  - `/`: 서비스 카드 아래 예약 진행 안내 섹션 추가
  - `/quote/[serviceCode]`: 현재 예상 금액 + 사진/주소/예약/결제 4단계 안내 추가
  - `/orders/[id]`: 안전한 주문 링크, 개인정보 보호, 1년 A/S 신뢰 스트립 추가
- 문서화:
  - `docs_lazyweb_ui_refactor.md` 추가
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - Vercel 프로덕션 배포 완료
- 배포 정보:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-mzn9xy3tb-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_6uKBSPMTjYv7truJcHzpYGc1kkfo`
- 재배포 후 프로덕션 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/login` 200 OK
- 운영 DB 확인:
  - 최신 주문 3건 조회 성공
  - 최신 주문번호: `BO-20260508-0001`
  - 최신 주문 상태: `inquiry`

## Phase 2-A: 토스페이먼츠 결제 실연동 (2026-05-08)

- 로컬 결제 환경변수 연결:
  - `NEXT_PUBLIC_TOSS_CLIENT_KEY`
  - `TOSS_SECRET_KEY`
  - `TOSS_WEBHOOK_SECRET`
  - `PAYMENT_MOCK_MODE=false`
- `/quote/[serviceCode]` 결제 흐름을 실결제창 방식으로 전환했다.
  - `POST /api/orders`
  - 사진이 있으면 `POST /api/orders/:id/media`
  - `POST /api/orders/:id/reservation`
  - `POST /api/quote`
  - `POST /api/quotes/:id/accept`
  - 토스 SDK v2 `requestPayment()` 호출
- 토스 결제 성공 URL을 `/orders/:orderId?accessToken=...&toss=success`로 연결했다.
- `/orders/[id]`에서 토스 성공 리다이렉트 파라미터를 감지해 자동 confirm을 호출하도록 추가했다.
  - `paymentKey`, `amount` 파라미터 확인
  - URL 파라미터 즉시 제거
  - `/api/payments/toss/confirm` 호출
  - 주문 상태 재조회
- 결제 실패/이탈 시 `/quote/[serviceCode]?toss=fail`에서 안내 메시지를 표시하고 입력값을 `sessionStorage`에서 복원하도록 처리했다.
- `/api/payments/toss/confirm`에서 실제 토스 승인 요청 시 `orderId`를 UUID 기준으로 보내도록 수정했다.
  - 단, `mock-`으로 시작하는 테스트 paymentKey는 기존 QA 플로우 보호를 위해 mock 승인 유지
- 토스 웹훅 서명 검증을 강화했다.
  - `TOSS_WEBHOOK_SECRET` 기반 Basic Authorization 검증 추가
  - 기존 `x-toss-signature` HMAC 검증도 함께 허용
  - `/api/payments/toss/webhook` alias route 추가
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과

## E2E 전체 흐름 테스트 + 예약 멱등성 수정 (2026-05-08)

- 프로덕션에서 `POST /api/orders/:id/reservation`이 409로 막히던 원인을 수정했다.
  - 원인 1: `reserve_order_slot` 함수가 Phase 1 `order_status` enum에 없는 MVP 상태값 `reservation_confirmed`를 사용했다.
  - 원인 2: 운영 DB `orders` 테이블에 없는 `scheduled_date` 컬럼을 업데이트했다.
  - 수정: 예약 성공 시 주문 상태는 Phase 1 기준 `scheduled`로 전환하고, 예약일은 `reservations` 및 `jobs` 기준으로 관리한다.
- 동일 `order_id` 예약 재호출은 409가 아니라 기존 예약을 반환하도록 멱등 처리했다.
  - `app/api/orders/[id]/reservation/route.ts`
  - `supabase/migrations/202605080008_reservation_idempotency.sql`
  - `supabase/migrations/202605080009_reservation_phase1_order_status.sql`
  - `supabase/migrations/202605080010_reservation_remove_order_scheduled_date.sql`
- 프로덕션 E2E 스크립트를 추가했다.
  - `scripts/prod-e2e-phase1.mjs`
  - `.env.local`의 `ADMIN_API_KEY`를 읽되 키값은 출력하지 않는다.
- 프로덕션 E2E 최종 검증 주문:
  - 주문번호: `BO-20260508-0022`
  - 주문 ID: `5a3b668d-7593-4190-b548-ef9e6d68a6bb`
  - 견적 ID: `1958d0c0-b100-48c7-9d3f-c144629e610b`
  - 작업 ID: `c6852e4c-c13b-4a1f-a5d0-f339101538fc`
- E2E 시나리오 결과:
  - 신규 주문 생성: PASS
  - 예약 생성: PASS
  - 견적 생성: PASS
  - 견적 수락: PASS
  - mock Toss 결제 confirm: PASS (`payments.status = done`, `provider_status = DONE`)
  - 동일 주문 예약 재호출: PASS (`idempotent = true`)
  - 동일 `paymentKey` 재호출: PASS (`duplicate = true`)
  - 슬롯 차단/예약 거부/해제: PASS (`SLOT_CLOSED`)
  - 기사 배정/시작/after 사진/완료/검수: PASS
  - 후기 제출/중복 방지/A/S 접수: PASS
- 운영 DB 최종 상태 확인:
  - `BO-20260508-0022`
  - `order_status = warranty`
  - `quote_accepted = true`
  - `payment_status = done`
  - `reserved_date = 2026-05-12`
  - `time_slot = morning`
  - `job_status = inspected`
  - `feedback_rating = 5`
- 운영 DB 무결성 체크:
  - `orders_without_customer = 0`
  - `payments_without_quote = 0`
  - `duplicate_feedbacks = 0`
  - `invalid_media = 0`
- 검증 결과:
  - `npm run typecheck` 통과
  - `npm run build` 통과
- Vercel 프로덕션 재배포 완료:
  - Production URL: `https://buildus-care-flow.vercel.app`
  - Deployment URL: `https://buildus-care-flow-cm3e9fwy1-juns-projects-58815d6e.vercel.app`
  - Deployment ID: `dpl_A2qiDCATqABN27VndRgdDy34fNNU`
- 재배포 후 프로덕션 응답 확인:
  - `/` 200 OK
  - `/quote/toilet_replace` 200 OK
  - `/admin/login` 200 OK
