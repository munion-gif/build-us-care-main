# Project Architecture Overview

분석 기준: `README.md`, `backend-spec.md`를 먼저 읽고, 현재 저장소의 실제 파일 경로와 대조했다. 이 문서는 구현 제안서가 아니라 현재 저장소 파악용 문서다. 코드, 패키지, DB migration 변경은 하지 않았다.

## 1. 프로젝트 정체성

이 저장소는 `Buildus Care` 홈서비스/시공 예약형 웹앱이다. 기술 스택은 `package.json` 기준 Next.js App Router, React, Supabase, Zod, Toss 결제, lucide-react를 사용한다.

`README.md`의 현재 목표는 정식 카탈로그가 없어도 `주문 생성 -> 예약 -> 결제 mock 승인 -> 작업 상태 변경 -> 게스트 상태 조회` 흐름을 로컬에서 검증하는 것이다.

`backend-spec.md`의 Phase 1 목표는 고객, 집, 주문, 견적, 결제, 작업, 사진, 검수, 후기, 기사, 자재 데이터를 하나의 운영 흐름으로 연결하는 것이다. 특히 `orders`와 `jobs`를 분리하고, 민감 데이터는 서버 API와 RLS로 보호하는 구조를 기준으로 삼는다.

주요 실행 스크립트는 `package.json`에 있다.

- `npm run dev`: Next.js 개발 서버
- `npm run build`: Next.js 빌드
- `npm run start`: Next.js 시작
- `npm run lint`: Next lint
- `npm run typecheck`: `tsconfig.typecheck.json` 기준 타입체크

## 2. 최상위 구조

주요 디렉터리와 역할은 다음과 같다.

| 경로 | 역할 |
| --- | --- |
| `app/` | Next.js App Router 페이지와 Route Handler |
| `components/` | 홈, 견적, 주문 상태 UI 컴포넌트 |
| `lib/` | Supabase 클라이언트, 인증, 견적, 검증, 상태/포맷, 추적, 저장소 유틸 |
| `supabase/migrations/` | DB schema, RLS, 인덱스, 기능별 확장 migration |
| `supabase/verification/` | SQL 기반 검증 스크립트 |
| `docs/` | 데이터 수집, UX, 주문 상태 매핑 등 보조 문서 |
| `scripts/` | Supabase SQL 적용, export 등 운영/개발 스크립트 |
| `public/` | favicon, manifest |

빌드 산출물과 로컬 실행 흔적도 같이 존재한다. `.next/`, `node_modules/`, 로그 파일, `.tmp-*`, `.lazyweb/`는 현재 분석 대상 코드와 구분해야 한다.

## 3. 고객 플로우

고객 플로우는 홈에서 서비스 선택, 견적 입력, 주문 생성, 사진 업로드, 예약, 견적 수락, 결제, 상태 조회로 이어진다.

### 3.1 홈/서비스 진입

진입점:

- `app/page.tsx`
- `app/home-client.tsx`
- `components/home/*`
- `app/services/page.tsx`
- `app/services/services-client.tsx`

`app/page.tsx`는 `lib/service-items.ts`의 `getAllServiceItems()`와 `lib/faqs.ts`의 `getPublicFaqs()`를 호출해 홈에 서비스와 FAQ를 내려준다. 홈 클라이언트는 유입 정보를 `lib/traffic-source.ts`, `lib/use-tracking.ts`, `lib/event-types.ts`와 연결해 이벤트를 남긴다.

서비스 데이터는 Supabase가 설정되어 있으면 `service_items`에서 읽고, 없거나 실패하면 `lib/service-items.ts`의 `HOME_FALLBACK_ITEMS`를 사용한다.

### 3.2 견적/주문 작성

진입점:

- `app/quote/[serviceCode]/page.tsx`
- `app/quote/[serviceCode]/quote-detail-client.tsx`
- `components/quote/*`

`app/quote/[serviceCode]/page.tsx`는 `getServiceItem()`, `getMaterialsBySku()`로 서비스와 자재 후보를 읽는다. 클라이언트 화면은 고객 정보, 주소, 집 정보, 사진, 예약 슬롯, 옵션, 결제 준비를 한 화면에서 처리한다.

`quote-detail-client.tsx`에서 실제 호출하는 주요 API:

- `GET /api/orders?phone=...`: 이전 주문 조회
- `GET /api/slots?year=...&month=...`: 예약 슬롯 조회
- `POST /api/orders`: 고객, 집, 주문, 작업 생성
- `POST /api/orders/:id/media/upload-url`: 고객 사진 signed upload URL 발급
- `POST /api/orders/:id/media`: 고객 사진 metadata 저장
- `POST /api/orders/:id/reservation`: 예약 연결
- `POST /api/quote`: 견적 저장
- `POST /api/quotes/:id/accept`: 견적 수락
- `POST /api/payments/toss/confirm`: mock 또는 real 결제 승인

### 3.3 주문 상태/후속 액션

진입점:

- `app/orders/[id]/page.tsx`
- `app/orders/[id]/order-status-client.tsx`
- `components/orders/*`
- `app/orders/lookup/page.tsx`
- `app/orders/lookup/order-lookup-client.tsx`

`app/orders/[id]/page.tsx`는 `accessToken`을 받아 `OrderStatusClient`에 전달한다. 실제 상태 데이터는 클라이언트가 `GET /api/orders/:id/status`를 `Authorization: Bearer <accessToken>` 헤더로 호출해 가져온다.

주문 상태 화면의 후속 액션:

- `POST /api/payments/toss/confirm`: Toss 성공 redirect 후 승인 확인
- `POST /api/orders/:id/feedback`: 후기/NPS
- `POST /api/orders/:id/warranty`: A/S 요청
- `POST /api/orders/:id/cancel`: 취소 요청
- `PATCH /api/orders/:id/reschedule`: 일정 변경 요청
- `GET /api/slots`: 변경 가능 슬롯 조회

고객용 상태 API는 `app/api/orders/[id]/status/route.ts`에서 이름, 전화번호, 주소를 마스킹하고 `access_token` 원문을 응답에서 제외한다.

### 3.4 사진 판정/사례

관련 경로:

- `app/request/photo/page.tsx`
- `app/request/photo/photo-request-client.tsx`
- `app/request/photo/result/page.tsx`
- `app/request/photo/result/photo-result-client.tsx`
- `app/cases/page.tsx`
- `app/cases/cases-client.tsx`
- `app/api/diagnoses/route.ts`
- `app/api/diagnoses/[id]/route.ts`
- `app/api/cases/route.ts`

사진 판정은 고객이 사진과 정보를 제출해 `diagnoses` 계열 API로 저장/조회하는 흐름이다. 관리자에는 `/admin/diagnoses`가 별도 존재한다.

## 4. 관리자 플로우

관리자 UI는 `app/admin/layout.tsx`가 `app/admin/admin-shell.tsx`를 감싼다. `/admin` 루트는 `app/admin/page.tsx`에서 `/admin/dashboard`로 redirect한다.

관리자 메뉴는 `app/admin/admin-shell.tsx`에 정의되어 있다.

| 화면 | 주요 파일 | 역할 |
| --- | --- | --- |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | 당일 주문, 결제, 방문, A/S, 미배정, 진단, 후기, 매출 요약 |
| `/admin/orders` | `app/admin/orders/page.tsx` | 주문 목록, 필터, 기사 배정, 취소 처리 |
| `/admin/orders/[id]` | `app/admin/orders/[id]/page.tsx` | 주문 상세 |
| `/admin/jobs` | `app/admin/jobs/page.tsx`, `app/admin/jobs/jobs-client.tsx` | 현장 작업 관리 |
| `/admin/jobs/[id]` | `app/admin/jobs/[id]/page.tsx` | 작업 상세 |
| `/admin/diagnoses` | `app/admin/diagnoses/*` | 사진 판정 관리 |
| `/admin/technicians` | `app/admin/technicians/*` | 기사 관리 |
| `/admin/slots` | `app/admin/slots/*` | 예약 슬롯 관리 |
| `/admin/analytics` | `app/admin/analytics/page.tsx` | 운영 분석 |
| `/admin/funnel` | `app/admin/funnel/page.tsx` | 퍼널 분석 |
| `/admin/settings` | `app/admin/settings/*` | 앱 설정, FAQ 관리 |

관리자 주요 API:

- `app/api/admin/auth/route.ts`: 관리자 로그인
- `app/api/admin/logout/route.ts`: 로그아웃
- `app/api/admin/orders/route.ts`: 주문 목록
- `app/api/admin/orders/[id]/route.ts`: 주문 수정
- `app/api/admin/orders/[id]/status/route.ts`: 주문 상태 변경
- `app/api/admin/orders/unassigned-count/route.ts`: 미배정/취소 요청 카운트
- `app/api/admin/orders/export/route.ts`: 주문 export
- `app/api/admin/jobs/route.ts`: 작업 생성/목록
- `app/api/admin/jobs/[id]/route.ts`: 작업 상세/삭제
- `app/api/admin/jobs/[id]/assign/route.ts`: 기사 배정
- `app/api/admin/jobs/[id]/start/route.ts`: 작업 시작
- `app/api/admin/jobs/[id]/complete/route.ts`: 작업 완료
- `app/api/admin/jobs/[id]/inspect/route.ts`: 검수
- `app/api/admin/jobs/[id]/status/route.ts`: 작업 상태 변경
- `app/api/admin/jobs/[id]/media/*`: 작업 미디어 업로드
- `app/api/admin/technicians/route.ts`: 기사 목록/생성/수정
- `app/api/admin/slot-configs/*`: 슬롯 설정
- `app/api/admin/faqs/*`: FAQ 관리
- `app/api/admin/cancellations/[id]/approve/route.ts`: 취소 승인
- `app/api/admin/cancellations/[id]/reject/route.ts`: 취소 반려
- `app/api/admin/analytics/route.ts`, `app/api/admin/funnel/route.ts`, `app/api/admin/stats/route.ts`: 분석/통계
- `app/api/admin/events/export/route.ts`, `app/api/admin/sessions/export/route.ts`: 데이터 export

## 5. 기사 플로우

기사 UI는 `app/technician/layout.tsx`가 `app/technician/technician-shell.tsx`를 감싼다.

주요 화면:

- `app/technician/login/page.tsx`: 토큰 로그인
- `app/technician/page.tsx`: 기사 일정 목록
- `app/technician/technician-jobs-client.tsx`: `/api/technician/jobs` 호출
- `app/technician/[jobId]/page.tsx`: 작업 상세 진입
- `app/technician/[jobId]/technician-job-detail-client.tsx`: 상세 UI
- `app/technician/[jobId]/checkin/*`: 시공 시작
- `app/technician/[jobId]/photos/*`: 현장 사진 업로드
- `app/technician/[jobId]/complete/*`: 완료 보고

기사 주요 API:

- `app/api/technician/auth/route.ts`: 기사 access token 검증 후 `tech_session` 쿠키 설정
- `app/api/technician/jobs/route.ts`: 로그인 기사에게 배정된 작업 목록
- `app/api/technician/jobs/[id]/route.ts`: 기사 본인의 작업 상세
- `app/api/technician/jobs/[id]/start/route.ts`: 작업 시작
- `app/api/technician/jobs/[id]/complete/route.ts`: 작업 완료
- `app/api/technician/jobs/[id]/media/upload-url/route.ts`: 사진 업로드 URL
- `app/api/technician/jobs/[id]/media/route.ts`: 사진 metadata 저장

`lib/technician-auth.ts`의 `requireTechnician()`은 `tech_session` 쿠키를 읽고 `technicians.access_token`과 `is_active = true`를 확인한다. `readTechnicianJobOrForbidden()`은 `jobs.id`와 `technician_id`를 함께 조건으로 걸어 타 기사 작업 접근을 막는다.

## 6. 핵심 API 흐름

### 6.1 주문 생성

파일: `app/api/orders/route.ts`

`POST /api/orders` 동작:

1. Supabase 환경 확인
2. `lib/validation.ts`의 `createOrderSchema`로 요청 검증
3. `lib/quote.ts`의 `calculateQuote()`로 임시 견적 계산
4. 전화번호 기준 `customers` 조회 후 생성 또는 업데이트
5. `homes`에서 같은 고객/주소 조회 후 생성 또는 업데이트
6. `orders` 생성
7. `events`에 `QUOTE_SUBMITTED` 기록
8. `sessions`가 있으면 생성/업데이트
9. `jobs`를 `received` 상태로 생성
10. `job_status_logs`, `notifications` 기록
11. `notifyNewOrder()` 호출
12. `statusUrl` 반환

주의: 같은 파일의 `GET /api/orders?phone=...`는 전화번호 기준 최근 주문 5건을 반환한다.

### 6.2 견적 생성/수락

파일:

- `app/api/quote/route.ts`
- `app/api/quotes/[id]/accept/route.ts`
- `lib/quote.ts`
- `lib/server-quote.ts`

`POST /api/quote`는 `order_id`가 없으면 `lib/quote.ts`의 클라이언트 입력 단가 기반 계산 결과만 반환한다. `order_id`가 있으면 `lib/server-quote.ts`의 `calculateServerQuote()`를 사용해 `service_items`, `materials` 기준으로 서버 견적을 만들고 `quotes`에 version을 올려 저장한다. 이후 `orders.status`를 `quoted`로 변경한다.

`POST /api/quotes/:id/accept`는 `quotes.accepted_at`을 기록하고 `orders.status`를 `payment_pending`으로 변경한다.

### 6.3 결제

파일:

- `app/api/payments/toss/confirm/route.ts`
- `app/api/webhooks/toss/route.ts`
- `app/api/payments/toss/webhook/route.ts`
- `lib/toss.ts`

`POST /api/payments/toss/confirm`는 주문과 최신 accepted quote를 조회하고, 결제 amount가 `quotes.total_final`과 일치하는지 확인한다. `payment_key` 중복은 기존 결제와 주문/견적/금액 일치를 검증해 멱등 성공 또는 충돌로 처리한다. 결제 성공 시 `payments`, `payment_events`, `orders.status = paid`, `events`를 업데이트한다.

`app/api/payments/toss/webhook/route.ts`는 `app/api/webhooks/toss/route.ts`의 `POST`를 re-export한다. 실제 webhook 구현은 `app/api/webhooks/toss/route.ts` 하나다.

Webhook은 mock mode가 아니면 `TOSS_WEBHOOK_SECRET` 기반 Basic Auth 또는 signature 검증을 수행한다. `payment_events.idempotency_key`로 중복 이벤트를 막는다.

### 6.4 예약/슬롯

관련 파일:

- `app/api/slots/route.ts`
- `app/api/reservations/slots/route.ts`
- `app/api/orders/[id]/reservation/route.ts`
- `app/api/orders/[id]/reschedule/route.ts`
- `app/api/admin/slot-configs/*`
- `supabase/migrations/202605080006_reservation_slot_guard.sql`
- `supabase/migrations/202605080006_slot_config_admin.sql`
- `supabase/migrations/202605080007_reserve_order_slot_enum_fix.sql`
- `supabase/migrations/202605080008_reservation_idempotency.sql`
- `supabase/migrations/202605080009_reservation_phase1_order_status.sql`
- `supabase/migrations/202605080010_reservation_remove_order_scheduled_date.sql`

예약 슬롯은 `slot_configs`, `reservations`, `jobs`, active technicians 수와 연결되어 있다. DB 함수 `reserve_order_slot`은 여러 migration에서 반복 갱신되었다. 예약/일정 변경은 회귀 위험이 높은 영역이다.

### 6.5 미디어

관련 파일:

- `app/api/orders/[id]/media/upload-url/route.ts`
- `app/api/orders/[id]/media/route.ts`
- `app/api/orders/[id]/photos/upload-url/route.ts`
- `app/api/orders/[id]/photos/route.ts`
- `app/api/admin/jobs/[id]/media/upload-url/route.ts`
- `app/api/admin/jobs/[id]/media/route.ts`
- `app/api/technician/jobs/[id]/media/upload-url/route.ts`
- `app/api/technician/jobs/[id]/media/route.ts`
- `lib/media.ts`
- `lib/storage.ts`

현재 코드에는 `media` 기반 API와 과거 `photos` 기반 API가 모두 남아 있다. `README.md`에도 `order_photos` 기반 설명이 있고, 현재 고객 견적 화면은 `media` API를 호출한다. 미디어/사진 관련 작업은 구 API와 신 API의 공존을 확인해야 한다.

### 6.6 후기/A/S/취소

관련 파일:

- `app/api/orders/[id]/feedback/route.ts`
- `app/api/reviews/route.ts`
- `app/api/orders/[id]/warranty/route.ts`
- `app/api/orders/[id]/cancel/route.ts`
- `app/api/admin/cancellations/[id]/approve/route.ts`
- `app/api/admin/cancellations/[id]/reject/route.ts`
- `supabase/migrations/202605080001_feedbacks_score_columns.sql`
- `supabase/migrations/202605080002_warranty_cases_fields.sql`
- `supabase/migrations/202605110006_cancellations.sql`

후기는 `feedbacks` 중심 API와 과거 `reviews` API가 같이 존재한다. 취소는 고객 요청과 관리자 승인/반려 흐름으로 분리되어 있다.

## 7. 인증 구조

### 7.1 Supabase 접근

파일: `lib/supabase.ts`

서버는 `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 있을 때만 Supabase admin client를 만든다. 클라이언트 직접 DB 접근이 아니라 Route Handler에서 service role로 접근하는 구조다.

### 7.2 관리자 인증

관련 파일:

- `middleware.ts`
- `lib/admin-auth.ts`
- `app/admin/login/page.tsx`
- `app/api/admin/auth/route.ts`
- `app/api/admin/logout/route.ts`

관리자 화면 접근은 `middleware.ts`에서 `/admin` 경로를 검사한다. `/admin/login`을 제외하고 `admin_session` 쿠키가 `ADMIN_SESSION_SECRET`과 일치하지 않으면 로그인으로 redirect한다.

관리자 API는 `lib/admin-auth.ts`의 `requireAdmin()`을 사용한다. `admin_session` 쿠키가 유효하면 통과하고, 아니면 `x-admin-key`가 `ADMIN_API_KEY` 목록에 포함되는지 검사한다.

### 7.3 기사 인증

관련 파일:

- `middleware.ts`
- `lib/technician-auth.ts`
- `app/technician/login/page.tsx`
- `app/api/technician/auth/route.ts`

기사 화면 접근은 `middleware.ts`에서 `/technician` 경로를 검사한다. URL query의 `token`이 있으면 `tech_session` 쿠키로 저장하고 `/technician`으로 redirect한다. 쿠키가 없으면 `/technician/login`으로 보낸다.

기사 API는 `lib/technician-auth.ts`의 `requireTechnician()`으로 `tech_session` 쿠키를 `technicians.access_token`과 대조한다.

### 7.4 게스트 주문 조회

파일: `app/api/orders/[id]/status/route.ts`

게스트는 `Authorization: Bearer <accessToken>` 또는 query의 `accessToken`으로 접근한다. `accessTokenSchema`는 48자리 hex 문자열을 요구한다. 관리자 키가 있으면 access token 검증 없이 조회할 수 있다.

## 8. 데이터 모델

### 8.1 스펙 기준 핵심 관계

`backend-spec.md` 기준 관계:

- `customers`는 여러 `homes`와 `orders`를 가진다.
- `homes`는 여러 `orders`의 방문 주소 기준이다.
- `orders`는 `quotes`, `payments`, `jobs`, `feedbacks`와 연결된다.
- `jobs`는 `technicians`, `media`, `inspections`와 연결된다.
- `payments`는 `payment_events`와 연결된다.

### 8.2 현재 migration 기준 주요 테이블

초기 MVP migration:

- `supabase/migrations/202605060001_init_backend_mvp.sql`
- 생성: `customers`, `products`, `product_options`, `service_items`, `orders`, `addresses`, `order_items`, `order_photos`, `reservations`, `payments`, `payment_events`, `jobs`, `job_status_logs`, `notifications`, `reviews`

Phase 1 foundation:

- `supabase/migrations/202605070001_phase1_foundation.sql`
- 생성: `homes`, `quotes`, `technicians`, `materials`, `media`, `inspections`, `feedbacks`, `warranty_cases`

이후 주요 확장:

- `202605070002_phase1_existing_table_expansion.sql`: 기존 테이블 확장
- `202605070004_phase1_indexes_rls.sql`: Phase 1 테이블 인덱스/RLS
- `202605070005_phase1_media_owner_xor.sql`: media owner 제약
- `202605070006_phase1_feedback_fields.sql`: feedback 필드
- `202605070007_phase1_jobs_operations.sql`: job 운영 필드
- `202605070008_phase1_drop_legacy_tables.sql`: legacy table cleanup
- `202605070009_service_items.sql`, `202605070010_home_service_items.sql`: 서비스 항목 확장
- `202605070011_diagnoses.sql`: 진단
- `202605080004_events_tracking.sql`: 이벤트 추적
- `202605080005_slots_config.sql` 및 `202605080006*`~`202605080010*`: 슬롯/예약 함수
- `202605110002_app_configs_launch_readiness.sql`: 앱 설정
- `202605110006_cancellations.sql`: 취소
- `202605110007_perf_indexes.sql`: 성능 인덱스
- `202605110008_faqs_and_technician_profiles.sql`: FAQ와 기사 프로필
- `202605130001_instagram_campaign_data_collection.sql`: Instagram/캠페인 데이터 수집, `sessions`, dimension 테이블

### 8.3 코드 기준 주요 타입/검증

관련 파일:

- `lib/types.ts`: `OrderStatus`, `ReservationStatus`, `PaymentStatus`, `JobStatus`, 견적 타입
- `lib/validation.ts`: 모든 주요 요청 Zod schema
- `lib/service-items.ts`: 서비스/자재 조회와 fallback
- `lib/server-quote.ts`: DB 가격 기반 견적
- `lib/quote.ts`: order_id 없는 임시 견적 계산

상태값은 스펙보다 코드가 넓게 허용한다. 예를 들어 `OrderStatus`에는 `submitted`, `completed`, `cancel_requested`, `cancelled`가 남아 있고, 스펙의 canonical 흐름인 `inquiry -> quoted -> payment_pending -> paid -> scheduled -> in_progress -> done -> canceled`와 완전히 일치하지 않는다.

## 9. 회귀 위험 구간

### 9.1 주문/견적/결제 순서

위험 파일:

- `app/quote/[serviceCode]/quote-detail-client.tsx`
- `app/api/orders/route.ts`
- `app/api/quote/route.ts`
- `app/api/quotes/[id]/accept/route.ts`
- `app/api/payments/toss/confirm/route.ts`
- `lib/quote.ts`
- `lib/server-quote.ts`

현재 고객 견적 화면은 주문 생성, 예약, 견적 생성, 견적 수락, 결제를 순차 호출한다. `app/api/payments/toss/confirm/route.ts`는 accepted quote를 요구하므로, `quote` 또는 `accept` 흐름이 깨지면 결제가 막힌다.

`POST /api/quote`는 `order_id` 유무에 따라 계산 방식이 달라진다. `order_id`가 없으면 요청 단가 기반 `calculateQuote()`이고, 있으면 DB 기반 `calculateServerQuote()`다. 가격 관련 수정은 두 경로의 차이를 명시적으로 다뤄야 한다.

### 9.2 상태값 불일치

위험 파일:

- `lib/types.ts`
- `lib/validation.ts`
- `lib/order-status-label.ts`
- `lib/format.ts`
- `app/orders/[id]/order-status-client.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/orders/page.tsx`
- `app/api/admin/jobs/[id]/status/route.ts`
- `app/api/admin/orders/[id]/status/route.ts`

스펙, migration enum, TypeScript union, UI 조건문에 남은 상태값이 일부 다르다. `completed`, `done`, `inspected`, `cancelled`, `canceled`, `cancel_requested`, `quoted` 같은 값이 여러 경로에서 섞여 보인다. 상태 전이 작업은 전체 검색 후 진행해야 한다.

### 9.3 예약 슬롯과 동시성

위험 파일:

- `app/api/slots/route.ts`
- `app/api/orders/[id]/reservation/route.ts`
- `app/api/orders/[id]/reschedule/route.ts`
- `app/api/admin/jobs/route.ts`
- `app/api/admin/slot-configs/*`
- `supabase/migrations/202605080006_reservation_slot_guard.sql`
- `supabase/migrations/202605080006_slot_config_admin.sql`
- `supabase/migrations/202605080007_reserve_order_slot_enum_fix.sql`
- `supabase/migrations/202605080008_reservation_idempotency.sql`
- `supabase/migrations/202605080009_reservation_phase1_order_status.sql`
- `supabase/migrations/202605080010_reservation_remove_order_scheduled_date.sql`

`reserve_order_slot` DB 함수가 여러 migration에서 재정의되어 있다. 슬롯 수, active technician 수, 예약 상태, 일정 변경, 관리자 배정이 얽혀 있으므로 작은 수정도 중복 예약 또는 예약 불가 판정 오류를 만들 수 있다.

### 9.4 사진/미디어 legacy 공존

위험 파일:

- `app/api/orders/[id]/photos/*`
- `app/api/orders/[id]/media/*`
- `app/api/admin/jobs/[id]/media/*`
- `app/api/technician/jobs/[id]/media/*`
- `lib/media.ts`
- `lib/storage.ts`
- `supabase/migrations/202605060003_order_photo_storage.sql`
- `supabase/migrations/202605070001_phase1_foundation.sql`
- `supabase/migrations/202605070005_phase1_media_owner_xor.sql`

`README.md`에는 `order_photos` 설명이 남아 있고, 현재 견적 화면은 `media` API를 사용한다. 새 작업은 어느 API를 유지하고 어느 API를 legacy로 볼지 먼저 정해야 한다.

### 9.5 인증/PII 노출

위험 파일:

- `middleware.ts`
- `lib/admin-auth.ts`
- `lib/technician-auth.ts`
- `app/api/orders/[id]/status/route.ts`
- `app/api/admin/*`
- `app/api/technician/*`

관리자 화면은 세션 쿠키, 관리자 API는 세션 쿠키 또는 `x-admin-key`를 허용한다. 기사 API는 `tech_session` 쿠키를 사용한다. 고객 상태 조회는 access token을 사용한다. 각 역할별로 마스킹 수준이 다르므로 API 응답 필드 변경 시 PII 노출 여부를 확인해야 한다.

특히 `app/api/orders/[id]/status/route.ts`는 고객 응답에서 마스킹을 수행하지만, 관리자 키가 있으면 전체 데이터를 반환한다. 이 API를 재사용할 때 호출자가 관리자 키를 보내는지 확인해야 한다.

### 9.6 Supabase 환경 없는 fallback

위험 파일:

- `lib/supabase.ts`
- `lib/service-items.ts`
- `lib/faqs.ts`
- `app/api/health/route.ts`
- `app/api/service-items/route.ts`
- `app/api/quote/route.ts`

일부 API와 화면은 Supabase 없이도 fallback이 있지만, 주문 생성/상태 조회/관리자/기사 기능은 Supabase가 필요하다. 로컬 검증 시 `.env.local` 유무에 따라 같은 화면의 동작이 달라질 수 있다.

### 9.7 이벤트/세션/캠페인 추적

위험 파일:

- `lib/tracking.ts`
- `lib/use-tracking.ts`
- `lib/traffic-source.ts`
- `lib/data-collection.ts`
- `app/api/events/route.ts`
- `app/api/admin/events/export/route.ts`
- `app/api/admin/sessions/export/route.ts`
- `supabase/migrations/202605130001_instagram_campaign_data_collection.sql`

홈, 견적, 주문, 결제, 상태 조회는 `events`와 `sessions`에 데이터를 남긴다. 유입/캠페인 관련 수정은 주문 생성과 이벤트 export까지 같이 봐야 한다.

### 9.8 알림/운영 로그

위험 파일:

- `lib/notify-admin.ts`
- `lib/operational-log.ts`
- `app/api/orders/route.ts`
- `app/api/payments/toss/confirm/route.ts`
- 관리자 API 전반

주문 생성과 결제 완료는 notification/외부 알림을 호출한다. 운영 로그는 관리자 API와 결제 API에서 request id, admin key fingerprint, identifiers를 남긴다. API 리팩터 시 로그가 빠지면 운영 추적성이 약해진다.

## 10. 검증 자산

문서/검증 파일:

- `README.md`: 수동 API 시나리오와 Lab 페이지 설명
- `backend-spec.md`: Phase 1 데이터/API 계약
- `scripts/smoke-test.http`: README에서 언급된 수동 smoke scenario
- `supabase/verification/*.sql`: phase별 SQL 검증
- `QA_REPORT.md`, `UI_UX_VERIFICATION.md`, `PERF_REPORT.md`, `EXCEL_STAGE_QA_REPORT.md`: 기존 검증 기록
- `docs/order-status-mapping.md`: 주문 상태 매핑 문서
- `docs/data_collection_schema.md`: 데이터 수집 스키마
- `docs/data_export_manual.md`: export 수동 절차

현재 이 문서 작성 과정에서는 테스트나 빌드를 실행하지 않았다. 요청이 “구현 금지”였기 때문에 파일 분석과 문서 작성만 수행했다.

## 11. 다음 작업 지시 단위 제안

다음 작업은 한 번에 크게 묶기보다 아래 단위로 나누는 것이 좋다.

1. `상태값 정합성 감사만 해라`: `order_status`, `job_status`, UI label, API 전이를 파일별로 표로 만들고 수정은 하지 않는다.
2. `고객 주문 생성 플로우만 리뷰해라`: `quote-detail-client.tsx`, `/api/orders`, `/api/quote`, `/api/quotes/:id/accept`, `/api/payments/toss/confirm`의 실제 순서와 실패 케이스를 점검한다.
3. `예약/슬롯 플로우만 리뷰해라`: `/api/slots`, reservation/reschedule, `reserve_order_slot` migration 계열, 관리자 배정을 함께 분석한다.
4. `미디어 API 정리 계획만 작성해라`: `photos` legacy와 `media` API의 사용처를 찾고 제거/유지 기준을 문서화한다.
5. `인증/PII 노출 리뷰만 해라`: 관리자, 기사, 게스트 API 응답 필드와 마스킹을 확인한다.
6. `Supabase migration 현황표만 만들어라`: migration별 생성/변경 테이블과 verification SQL을 연결해 문서화한다.
7. `실행 검증만 해라`: 코드 수정 없이 `npm run typecheck`, `npm run build`, 핵심 API smoke test 결과만 수집한다.

구현을 시작할 때는 위 항목 중 하나를 고르고, “분석 -> 수정 파일 목록 제안 -> 승인 후 구현” 순서로 진행하는 편이 안전하다.
