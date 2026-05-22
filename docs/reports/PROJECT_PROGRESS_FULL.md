# Buildus Care 프로젝트 진행 내역 통합 정리

작성일: 2026-05-14  
기준 위치: `C:\Users\user\Documents\New project`  
기준 자료: 현재 저장소의 코드, 문서, 마이그레이션, 검증 SQL, QA 보고서, 배포 보고서, 스크린샷/로그 산출물

## 1. 프로젝트 개요

Buildus Care는 Next.js App Router와 Supabase를 기반으로 만든 홈서비스/시공 예약형 웹앱이다. 초기 목표는 정식 카탈로그가 없어도 `주문 생성 -> 예약 -> 결제 mock 승인 -> 작업 상태 변경 -> 게스트 상태 조회`가 로컬과 프로덕션에서 검증되는 백엔드 MVP를 만드는 것이었다.

현재 프로젝트는 단순 백엔드 MVP를 넘어 고객 랜딩, 견적/예약/결제, 고객 주문 상태 조회, 관리자 운영 화면, 기사 모바일 앱, AI 사진 판정, 시공 사례, 이벤트/퍼널 추적, 예약 슬롯 관리, 취소/A/S, QA 자동화와 배포 검증까지 확장되어 있다.

주요 기술 스택은 다음과 같다.

| 영역 | 내용 |
| --- | --- |
| 프레임워크 | Next.js 15 App Router, React 19 |
| DB/백엔드 | Supabase, PostgreSQL, RLS, Route Handler |
| 검증 | TypeScript, Zod, SQL verification scripts |
| 결제 | Toss Payments confirm/webhook 구조, mock mode |
| AI | Anthropic Claude Vision 기반 사진 판정 구조 |
| UI | CSS, lucide-react, 모바일 우선 고객/기사/관리자 화면 |
| 배포 | Vercel Production `https://buildus-care-flow.vercel.app` |

## 2. 현재 실행/운영 구조

프로젝트 실행 스크립트는 `package.json` 기준으로 아래와 같다.

| 명령 | 역할 |
| --- | --- |
| `npm run dev` | Next.js 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | Next.js 프로덕션 서버 시작 |
| `npm run lint` | Next lint |
| `npm run typecheck` | `tsconfig.typecheck.json` 기준 타입체크 |

환경변수 구조는 `.env.example`, `.env.local`에 정리되어 있으며 Supabase URL/service role, Toss 키, mock 결제 모드, 관리자 API 키, 사이트 URL을 사용한다.

## 3. 저장소 구조

| 경로 | 진행 내용 |
| --- | --- |
| `app/` | 고객/관리자/기사 페이지, API Route Handler 전체 구현 |
| `components/` | 홈, 견적, 주문 상태, 레이아웃, 주문 카드, CTA, 모달 등 UI 컴포넌트 구현 |
| `lib/` | Supabase, 인증, 견적, 상태 전이, 포맷, 추적, 스토리지, 알림, 검증 유틸 구현 |
| `supabase/migrations/` | 초기 MVP부터 Phase 1/2/3, 성능, 슬롯, 취소, AI, 인스타 데이터 수집까지 DB migration 축적 |
| `supabase/verification/` | 각 기능별 SQL 검증 스크립트 작성 |
| `scripts/` | SQL 적용, 테스트 데이터 초기화, 프로덕션 QA, 로컬 시각 QA 등 자동화 스크립트 작성 |
| `docs/` | 데이터 수집, UX 계획, 주문 상태 매핑, 회원 주문함 로드맵 등 보조 문서 작성 |
| `screenshots/` | 모바일/데스크톱 브라우저 QA 캡처 보관 |
| 루트 `.md` 문서 | Phase 변경 로그, QA 보고서, 아키텍처, 상태 감사, 운영 대시보드, UX 구현 보고 등 작성 |

## 4. 주요 완료 범위 요약

| 영역 | 상태 |
| --- | --- |
| 고객 주문 생성 | 완료 |
| 견적 계산/저장/수락 | 완료 |
| Toss mock 결제 승인 | 완료 |
| 결제 webhook/event 저장 | 완료 |
| 예약 슬롯 조회/예약/변경 | 완료 |
| 고객 주문 상태 조회 | 완료 |
| 주문 링크 분실 시 이름+전화번호 조회 | 완료 |
| 고객 후기/NPS | 완료 |
| 고객 A/S 접수 | 완료 |
| 고객 취소 요청 | 완료 |
| 관리자 주문/작업/슬롯/기사/분석/설정 UI | 완료 |
| 관리자 운영 대시보드 | 완료 |
| 관리자 주문 수정 패널 | 완료 |
| 기사 모바일 웹앱 | 완료 |
| 기사 시작/완료/사진 업로드 | 완료 |
| AI 사진 판정 | 완료/운영 데이터 고도화 필요 |
| 시공 사례 화면/API | 완료 |
| 이벤트/UTM/인스타 유입 추적 | 완료 |
| 성능 계측/인덱스/페이지네이션 | 완료 |
| 상태값 감사/정리/QA | 진행 및 일부 배포 정렬 완료 |
| 실알림 카카오/SMS/이메일 | 구조 있음, 실제 채널 연동은 후속 |
| 멤버십/콘텐츠 트래픽/쿠폰 | 후속 |

## 5. Phase 0 / MVP 기반 작업

초기 MVP에서는 고객, 주문, 예약, 결제, 작업, 사진 업로드, 관리자 API의 기본 골격을 만들었다.

구현된 핵심 흐름은 다음과 같다.

1. `/api/health` 상태 확인
2. `/api/service-items` 임시 서비스 항목 조회
3. `/api/quote` 견적 계산
4. `/api/orders` 주문 생성
5. `/api/orders/:id/photos` 사진 메타데이터 저장
6. `/api/reservations/slots` 예약 슬롯 조회
7. `/api/orders/:id/reservation` 예약 연결
8. `/api/payments/toss/confirm` Toss mock 결제 승인
9. `/api/webhooks/toss` webhook 저장
10. `/api/orders/:id/status` 게스트 주문 상태 조회
11. `/api/admin/orders`, `/api/admin/jobs` 운영자 조회

정식 SKU/카탈로그 없이도 `order_items`에 `item_name`, `qty`, `unit_price`, `option_summary`, `line_total`, `metadata.service_type_code`를 스냅샷으로 저장해 광고/카톡 랜딩에서 바로 주문을 만들 수 있도록 구성했다.

## 6. Phase 1 데이터 모델/백엔드 리팩터

Phase 1의 기준은 `backend-spec.md`, `phase1-implementation-brief.md`, `phase1-migration-runbook.md`, `CHANGES_PHASE1.md`에 정리되어 있다. 목표는 고객, 집, 주문, 견적, 결제, 작업, 사진, 검수, 후기, 기사, 자재 데이터를 하나의 운영 흐름으로 연결하는 것이었다.

### 6.1 Phase 1 설계/문서

작성된 문서:

| 문서 | 내용 |
| --- | --- |
| `backend-spec.md` | Phase 1 백엔드 스펙, 도메인 모델, API 계약, 보안/RLS, 개발 순서 |
| `phase1-implementation-brief.md` | 팀 공유용 구현 브리핑 |
| `phase1-migration-runbook.md` | migration 적용 전 확인, 순서, 검증, 실패 대응 |
| `CHANGES_PHASE1.md` | 실제 변경 로그 전체 |

결정 사항:

- Phase 1은 새 기능 추가보다 DB/API 구조 전환을 우선했다.
- 마이그레이션은 단일 파일이 아니라 논리 단위로 분리했다.
- 기존 MVP 코드를 깨지 않도록 비파괴 확장 방식으로 시작했다.
- 실제 상태값 UPDATE는 API가 Phase 1 상태값을 지원한 뒤 controlled migration으로 처리하기로 했다.

### 6.2 Phase 1 DB migration

초기 분리 migration:

| 파일 | 내용 |
| --- | --- |
| `202605070001_phase1_foundation.sql` | enum 확장, `homes`, `quotes`, `technicians`, `materials`, `media`, `inspections`, `feedbacks`, `warranty_cases` 생성 |
| `202605070002_phase1_existing_table_expansion.sql` | `customers`, `orders`, `payments`, `jobs` 확장 및 기존 값 보강 |
| `202605070003_phase1_data_backfill.sql` | `order_photos -> media`, `reviews -> feedbacks` 이전 구조 |
| `202605070004_phase1_indexes_rls.sql` | Phase 1 인덱스, trigger, RLS/FORCE RLS, service role 정책 |

추가 Phase 1 migration:

| 파일 | 내용 |
| --- | --- |
| `202605070005_phase1_media_owner_xor.sql` | media owner 제약 |
| `202605070006_phase1_feedback_fields.sql` | feedback 세부 필드 |
| `202605070007_phase1_jobs_operations.sql` | 작업 운영 상태/로그/검수 구조 |
| `202605070008_phase1_drop_legacy_tables.sql` | legacy table 정리 |
| `202605070009_service_items.sql` | 서비스 항목 |
| `202605070010_home_service_items.sql` | 홈 서비스 항목 |
| `202605070011_diagnoses.sql` | 사진 판정/diagnoses |

검증 결과:

- Phase 1 핵심 테이블 8개 존재 확인
- `order_photos -> media`, `reviews -> feedbacks` 백필 누락 0건
- 신규 테이블 RLS enabled, FORCE RLS enabled 확인
- service role full access policy 확인
- typecheck/build 통과

### 6.3 `/api/orders` 리팩터

진행 내용:

- 전화번호 기준 `customers` 조회 후 생성/갱신
- 기존 고객이면 `first_contact_at` 유지
- 고객 주소/유입 스냅샷 최신 주문 기준 갱신
- `homes`는 `customer_id + address_full` 기준 재사용
- `orders`에 `home_id`, `channel`, `reason`, `urgency`, `skus`, `self_diagnosis` 저장
- `order_number`를 `BO-YYYYMMDD-NNNN` 형식으로 생성
- 주문 생성 응답에 고객용 `statusUrl` 포함
- 주문 생성 시 `jobs`, `job_status_logs`, `notifications`, `events`, `sessions` 연동

필수 수집값:

- `customers.acquisition_source`
- `orders.channel`
- `orders.reason`
- `orders.urgency`
- `homes.year_built`
- `orders.skus`
- `orders.self_diagnosis`

검증:

- 첫 주문 생성 성공
- 같은 고객/주소 재주문 성공
- customer/home 재사용 확인
- 주문번호 형식 확인
- `docs_phase1_order_refactor_test.md`, `phase1_order_refactor_checks.sql` 작성

### 6.4 `/api/quote` 리팩터

진행 내용:

- `order_id` 없으면 견적 미리보기로 유지
- `order_id` 있으면 `quotes` row 저장
- `service_items` DB 가격 기준으로 시공비 계산
- 프론트 단가는 신뢰하지 않고 `client_unit_price_ignored`로 metadata 보존
- `materials.metadata.material_skus` 기반 자재가 반영
- `version = 기존 최대 + 1`
- `/api/quotes/:id/accept` 추가
- 최초 수락 시 `accepted_at` 기록
- 재수락 시 `409 conflict`
- 견적 저장 후 주문 `quoted`, 견적 수락 후 `payment_pending`으로 전환

검증:

- `phase1_quote_checks.sql`
- `docs_phase1_quote_refactor_test.md`

### 6.5 결제 리팩터

진행 내용:

- `POST /api/payments/toss/confirm`에서 최신 accepted quote 기준으로 amount 검증
- `payment_key` 중복 시 주문/견적/금액 일치 여부에 따라 멱등 성공 또는 충돌 처리
- 결제 성공 시 `payments`, `payment_events`, `orders.status = paid`, `events` 업데이트
- Toss webhook은 `payment_events.idempotency_key`로 중복 방지
- real mode에서는 webhook secret 기반 Basic Auth 또는 signature 검증 구조 유지
- `/api/payments/toss/webhook`은 `/api/webhooks/toss` re-export

검증:

- `phase1_payment_checks.sql`
- 결제 `done`, provider status `DONE`, payment event 멱등 키 확인

### 6.6 Media API 리팩터

진행 내용:

- `media` 테이블 중심으로 order/job media 저장
- 고객 사진 업로드 signed URL 발급
- 주문/작업 media metadata 저장
- `media.type = before|during|after|material|issue` 등으로 분류
- owner XOR 제약 적용
- 기존 `order_photos` legacy 구조에서 Phase 1 media 구조로 이전

검증:

- `phase1_media_checks.sql`
- `docs_phase1_media_refactor_test.md`

### 6.7 Feedback API 리팩터

진행 내용:

- 후기/NPS 구조 확장
- 5축 점수, 재추천/재의뢰 의사, category 저장
- 중복 제출 방지
- 고객 상태 페이지 후기 CTA 유지

검증:

- `phase1_feedback_checks.sql`
- `docs_phase1_feedback_refactor_test.md`

### 6.8 Jobs 운영 API 리팩터

진행 내용:

- 작업 생성/배정/시작/완료/검수 흐름 정리
- `jobs.status`와 `orders.status` 동기화
- `job_status_logs` 기록
- 관리자 전용 작업 시작/완료/검수 API 정리
- 기사 앱 API와 운영 API의 작업 상태 흐름 연결

검증:

- `phase1_jobs_checks.sql`
- `phase1_jobs_test_seed.sql`
- `docs_phase1_jobs_refactor_test.md`

### 6.9 게스트 주문 상태 조회

진행 내용:

- `access_token` 기반 고객 주문 상태 조회
- 이름/전화번호/주소 마스킹
- 주문, 결제, 예약, 작업, 기사, 견적 정보 제공
- 원문 access token 응답 제외
- 고객용 라벨/타임라인/다음 액션 연결

## 7. 고객 화면/UX 구현

### 7.1 홈/서비스 진입

주요 파일:

- `app/page.tsx`
- `app/home-client.tsx`
- `components/home/*`
- `app/services/page.tsx`
- `app/services/services-client.tsx`

진행 내용:

- 홈 랜딩 구현
- 서비스 카드/검색/FAQ/신뢰 배지/하단 CTA 구현
- `getAllServiceItems()`, `getPublicFaqs()` 서버 데이터 연결
- Supabase 미설정 시 fallback service item 사용
- PWA manifest, favicon, safe area 대응
- 글로벌 네비게이션과 `/services` 페이지 추가

### 7.2 견적 상세/주문 작성

주요 파일:

- `app/quote/[serviceCode]/page.tsx`
- `app/quote/[serviceCode]/quote-detail-client.tsx`
- `components/quote/*`

진행 내용:

- 고객 정보, 주소, 집 정보, 사진, 예약 슬롯, 옵션, 결제 준비를 한 화면에서 처리
- 서비스별 견적 preset
- 즉시예약형/상담견적형 분기
- 필수/선택 입력 안내
- 모바일 sticky CTA 정리
- 견적 범위, 포함/제외/현장 추가 가능 안내
- 결제 후 일정 확정 흐름 안내
- draft 복원 오류 수정
- 고객 정보 런타임 오류 수정

### 7.3 주문 상태 조회

주요 파일:

- `app/orders/[id]/page.tsx`
- `app/orders/[id]/order-status-client.tsx`
- `components/orders/*`
- `app/orders/lookup/page.tsx`
- `app/orders/lookup/order-lookup-client.tsx`

진행 내용:

- 주문 생성 후 API 주소가 아닌 고객 화면 링크 반환
- `/orders/[id]?accessToken=...` 고객 상태 페이지 구현
- 결제 완료 카드, 북마크 안내, 공유 버튼 추가
- 주문 상태 한글 라벨과 현재 상태별 안내 문구 추가
- 기사 연락처 또는 대표번호 표시
- 결제 금액/수단 표시
- 예약 변경/취소 문의 안내
- `/orders/lookup` 추가
- 이름+전화번호 기반 주문 목록 조회로 개선
- 단일 링크가 아니라 최신순 주문 카드 목록 표시
- 상태별 `다음에 일어나는 일` 카드 추가
- `completed`와 `done`의 고객 문구 분리
- `done`에서만 A/S CTA 노출하도록 정리

### 7.4 예약 변경/취소/A/S

진행 내용:

- 고객 직접 예약 변경 UI 구현
- 슬롯 재검증
- 동일 슬롯 멱등 처리
- 마감/차단 슬롯 409 처리
- 기사 유지 가능 시 job schedule 업데이트
- 기사 유지 불가 시 job release 및 주문 `paid` 복원
- 시작된 작업은 변경 차단
- `events.event_type = reservation_rescheduled` 기록
- 고객 취소 요청 API/UX 추가
- 자동 취소와 관리자 검토 취소 요청 분기
- 관리자 취소 승인/반려 API 추가
- A/S는 최종 완료 `done` 이후 접수 가능하도록 고객 UX 정리

## 8. 시공 사례/사진 판정

### 8.1 `/cases` 시공 사례

진행 내용:

- 기존 placeholder를 실제 화면으로 교체
- `/api/cases` 공개 API 추가
- 기준 데이터: `jobs.status = inspected` + `media.type = after`
- Supabase Storage signed URL 서버 생성
- `category`, `limit`, `offset` 지원
- 모바일 2열, 데스크톱 3열 카드 그리드
- 카테고리 탭: 전체/배관/전기/도배/기타
- 서비스명 한글화, 완료 날짜 포맷, 별점 표시
- 데이터 없음 empty state 표시

### 8.2 사례 UX 고도화

진행 내용:

- `/cases`를 신뢰 자료 + 견적 전환 중간 단계로 재구성
- 서비스 유형 필터, 지역 필터 추가
- 대표 완료 이미지, 서비스명, 요약, 지역/주거 태그 표시
- 사례별 CTA: 견적 보기, 사진 판정
- 선택 사례 상세 패널 추가
- 전/후 비교, 문제, 작업 내용, 공간 정보 표시
- `/api/cases` 응답에 `before_image_url`, `summary`, `problem`, `work`, `region`, `building_type`, `tags`, `quote_href`, `photo_href`, `facets` 추가

### 8.3 AI 사진 판정

진행 내용:

- `diagnoses` 테이블/API 구조 구현
- `/request/photo`, `/request/photo/result` 화면 구현
- `/api/diagnoses`, `/api/diagnoses/:id` 구현
- 관리자 `/admin/diagnoses` 구현
- Anthropic Claude Vision 실연결 구조 추가
- AI 판정 preflight/verification SQL 작성
- 사진 판정 결과를 운영/마케팅/학습 데이터로 확장할 수 있는 기반 마련

남은 점:

- 실제 현장 사진 데이터 누적
- media angle/tags/AI label 운영 기준 강화
- 고급 AI 학습 파이프라인은 후속

## 9. 관리자 기능

### 9.1 관리자 인증/레이아웃

주요 파일:

- `app/admin/layout.tsx`
- `app/admin/admin-shell.tsx`
- `app/admin/login/page.tsx`
- `app/api/admin/auth/route.ts`
- `app/api/admin/logout/route.ts`
- `middleware.ts`

진행 내용:

- 관리자 로그인
- HttpOnly cookie 기반 보호
- `/admin` 접근 시 `/admin/dashboard` redirect
- 관리자 메뉴 구성
- 관리자 CSS/반응형 UI 정리

### 9.2 관리자 주문 관리

진행 내용:

- `/admin/orders` 주문 목록 구현
- 상태/검색/페이지네이션/필터
- `/admin/orders/[id]` 상세 구현
- 기사 배정/배정 취소
- 주문 상태 변경
- 취소 요청 처리
- 결제/예약/작업/고객 정보 표시
- `/api/admin/orders`, `/api/admin/orders/:id`, `/api/admin/orders/:id/status`
- `/api/admin/orders/export`
- `/api/admin/orders/unassigned-count`

### 9.3 관리자 운영 수정 1차

진행 내용:

- `/admin/orders/[id]`에 `운영 수정 1차` 패널 추가
- 고객명, 전화번호, 주소, 동/지역, 아파트/단지, 주문 메모 수정
- 예약 날짜/오전·오후 슬롯 수정
- 담당 기사 지정, 방문 예정 시각 조정
- 기존 배정 취소 유지
- A/S 상태, 책임 구분, resolved_at 처리
- 저장 전 `confirm()`
- 저장 성공 후 메시지/새로고침
- 시공 시작 이후 예약 변경 제한
- 관리자 변경을 `events.admin_order_updated`로 기록
- 별도 audit 테이블은 만들지 않음

검증:

- 테스트 주문 동일 값 저장 200
- 잘못된 예약 수정 400 한글 오류 메시지 확인

### 9.4 관리자 운영 대시보드

진행 내용:

- `/admin/dashboard` 추가
- 기존 `/admin` KPI/최근 주문 내용을 대시보드로 이관
- `/admin`은 `/admin/dashboard`로 redirect
- 상단 요약 카드: 오늘 주문, 오늘 결제 완료, 오늘 방문 예정, 오늘 신규 A/S
- 보조 KPI: 이번 주 매출, 판정 대기, 평균 NPS, 견적 미수락, 이슈, 이번 주 시공 완료, 최근 주문
- 미배정 `paid` 주문
- 내일 방문 예정인데 기사 미배정인 주문
- 오늘/내일 방문 일정
- 오늘 접수 A/S
- 최근 24시간 사진 판정 요약
- 오늘 예약 변경 수

검증:

- typecheck/build 통과
- Vercel 배포 완료
- 비로그인 `/admin/dashboard`는 `/admin/login` redirect
- 관리자 쿠키 포함 `/admin/dashboard` 200
- 프로덕션 숫자 sanity check 수행

### 9.5 관리자 슬롯/기사/분석/설정

진행 내용:

- `/admin/slots`: 슬롯 설정/관리
- `/api/admin/slot-configs`, `/api/admin/slot-configs/:date`
- active technicians 기준 슬롯 cap 자동 연동
- `/admin/technicians`: 기사 목록/생성/수정
- 기사 프로필 필드, 지역 note, active 상태
- `/admin/analytics`: 운영 분석
- `/admin/funnel`: 퍼널 분석
- `/admin/settings`: 앱 설정/FAQ 관리
- `/api/admin/faqs`, reorder/delete/update
- `/api/admin/events/export`, `/api/admin/sessions/export`

## 10. 기사 모바일 웹앱

Phase 3로 기사 모바일 웹앱을 구현했다.

### 10.1 라우트

| 경로 | 역할 |
| --- | --- |
| `/technician/login` | 기사 토큰 로그인 |
| `/technician` | 오늘 + 미래 일정 목록 |
| `/technician/[jobId]` | 현장 상세 |
| `/technician/[jobId]/checkin` | 시공 시작 |
| `/technician/[jobId]/photos` | before/during/after 사진 업로드 |
| `/technician/[jobId]/complete` | 완료 보고 |

### 10.2 인증/보안

진행 내용:

- `technicians.access_token`, `technicians.last_login_at` 컬럼 추가
- `?token=<technicianToken>` 진입 시 `tech_session` HttpOnly 쿠키 발급
- `POST /api/technician/auth` 추가
- `middleware.ts`에서 `/technician` 경로 보호
- 모든 기사 API에서 `tech_session` 검증
- `jobs.technician_id` 소유권 검증
- 시공 시작 24시간 전부터만 주소/전화 원본 노출, 그 전에는 마스킹

### 10.3 기사 API/현장 입력

API:

- `GET /api/technician/jobs`
- `GET /api/technician/jobs/:id`
- `PATCH /api/technician/jobs/:id/start`
- `PATCH /api/technician/jobs/:id/complete`
- `POST /api/technician/jobs/:id/media/upload-url`
- `POST /api/technician/jobs/:id/media`

현장 입력:

- 시작 시 `jobs.status = in_progress`, `started_at`
- 완료 보고 시 `jobs.status = done`, `actual_minutes`, `materials_used`, `completion_notes`, `issues`
- 사진 업로드 시 `media.job_id`, `media.type`

검증:

- `202605080003_technician_access_token.sql` 적용
- `phase3_technician_checks.sql` 실행
- typecheck/build 통과
- Vercel 배포
- `/technician/login` 200
- 토큰 없는 `/technician`은 307 redirect

## 11. 상태값 정합성/OrderStatus 정리

상태값은 프로젝트 중간에 가장 큰 회귀 위험 구간으로 감사/계획/구현/QA를 따로 진행했다.

### 11.1 감사 결과

`STATUS_CONSISTENCY_AUDIT.md`에서 확인된 주요 이슈:

- 주문 상태 정의가 `lib/types.ts`, `lib/validation.ts`, `lib/status.ts`, route handler, DB migration, UI 라벨 유틸에 분산
- DB enum/CHECK, TypeScript 타입, Zod, 운영 route handler가 서로 다른 세대 상태값을 함께 사용
- `quoted`, `draft`, `reservation_pending`, `reservation_confirmed`, `preparing`, `in_service`, `cancelled` 취급 불일치
- 작업 상태의 `completed`와 `done`/`inspected` 혼재
- DB에는 `payment_status.refunded`가 있지만 타입/UI 라벨에는 누락
- 예약 상태는 DB/type과 생성 검증 허용값이 다름

### 11.2 공식 운영 OrderStatus

정리 기준 공식 운영 상태:

```text
inquiry
quoted
payment_pending
paid
scheduled
in_progress
completed
done
issue
warranty
cancel_requested
canceled
```

정책:

- `submitted`, `draft`는 inquiry 계열 alias
- `reservation_pending`은 payment_pending 계열 alias
- `reservation_confirmed`, `preparing`은 scheduled 계열 alias
- `in_service`는 in_progress 계열 alias
- 주문 `cancelled` 입력은 `canceled`로 정규화
- 작업/예약의 `cancelled`는 별도 도메인으로 유지

### 11.3 상태 전이 UX

반영한 전이 UX:

| 규칙 | UI 반영 |
| --- | --- |
| `inquiry -> quoted` 허용 | 관리자 패널 `견적 완료` 버튼 |
| `quoted -> payment_pending` 허용 | 관리자 패널 `결제 대기` 버튼 |
| `inquiry -> payment_pending` 불가 | 직접 전환 버튼 숨김, 차단 안내 |
| `completed -> warranty` 불가 | warranty 버튼 숨김, 최종 완료 후 가능 안내 |
| `done -> warranty` 허용 | 고객 A/S CTA, 관리자 warranty 전환 |
| `scheduled -> done` 불가 | 작업 진행/완료 선행 안내 |
| `canceled -> paid` 불가 | 결제 전환 숨김, 새 문의 처리 안내 |

### 11.4 DB CHECK 정리

진행 내용:

- `DB_ORDER_STATUS_CHECK_PLAN.md` 작성
- `orders_status_check`에 `quoted` 누락 확인
- `202605130002_add_quoted_to_orders_status_check.sql` 추가
- `DEPLOY_ORDER_STATUS_ALIGNMENT.md` 작성
- 배포/DB 정렬 계획 수립

### 11.5 QA 결과

`QA_ORDER_STATUS_VERIFICATION.md` 기준:

- 로컬 코드/빌드 기준 typecheck/build 통과
- 공식 운영 상태 12개 확인
- alias/deprecated 정책 확인
- 상태 전이 검증
- 고객/관리자 UI 라벨 검증
- `김비데` 테스트 주문 기준 조회/상태/관리자 접근 확인

주의:

- 한 시점의 Vercel 배포본은 로컬 코드와 달라 `inquiry -> payment_pending`, `completed -> warranty` 일부 전이가 기대와 다르게 동작했다.
- DB CHECK에 `quoted`가 빠진 상태도 확인되어 migration으로 보강했다.

## 12. 예약/슬롯/일정 관리

진행 내용:

- `/api/slots` 월별 슬롯 응답 개선
- `/api/reservations/slots` 예약 슬롯 조회
- `/api/orders/:id/reservation` 예약 연결
- `/api/orders/:id/reschedule` 고객 예약 변경
- DB 함수 `reserve_order_slot` 기반 슬롯 중복 방지
- `slot_configs` 관리자 설정
- active technicians 수 기준 자동 cap 연동
- 슬롯 마감/차단 처리
- 날짜/오전·오후 UX 개선
- 관리자 슬롯 UI 구현

관련 migration:

- `202605080005_slots_config.sql`
- `202605080006_reservation_slot_guard.sql`
- `202605080006_slot_config_admin.sql`
- `202605080007_reserve_order_slot_enum_fix.sql`
- `202605080008_reservation_idempotency.sql`
- `202605080009_reservation_phase1_order_status.sql`
- `202605080010_reservation_remove_order_scheduled_date.sql`
- `202605110005_auto_slot_cap_by_active_technicians.sql`

검증:

- `phase2_slots_checks.sql`
- `phase2_slots_ux_checks.sql`
- `phase_slots_active_tech_checks.sql`
- 예약 변경 QA 전체 통과

## 13. 취소/환불/A/S

진행 내용:

- `202605110006_cancellations.sql` migration
- 고객 취소 요청 API
- 관리자 취소 승인/반려 API
- 자동 취소/수동 검토 분기
- 작업/예약 상태와 주문 상태 연동
- A/S 접수 `warranty_cases`
- `warranty` 상태 전환
- `completed`에서는 A/S CTA 숨김, `done`에서만 노출
- A/S 책임 구분/resolved_at 운영 수정 패널 연결

후속:

- 실제 환불 정책/Toss refund 연동
- A/S 책임/해결 SLA 운영 화면 강화

## 14. 이벤트/퍼널/인스타 유입

### 14.1 이벤트 추적

진행 내용:

- `events` tracking migration
- `lib/tracking.ts`, `lib/use-tracking.ts`, `lib/event-types.ts`
- 세션/이벤트 export API
- 홈, 견적, 주문, 사례 CTA 이벤트 기록
- 예약 변경, 주문 업데이트 등 운영 이벤트 기록

### 14.2 인스타그램 유입 UX

`INSTAGRAM_TRAFFIC_UX_REPORT.md` 기준 진행 내용:

- `lib/traffic-source.ts` 추가
- `utm_source`, `utm_medium`, `utm_campaign`, `ref`, `region` 정규화
- `instagram | direct | organic | kakao | phone | web | unknown` traffic source 처리
- 최초 유입 컨텍스트 `sessionStorage` 보존
- 랜딩, 사례, 주문조회, 견적 링크에 source query 유지
- 인스타 유입 시 홈 히어로 카피/CTA 분기
- 인스타 전용 배지/신뢰 포인트 노출
- 견적 화면 부담 완화 문구 추가
- 주문상태 결제 후 안내 문구 보강
- 사례/주문조회도 source-aware 처리
- 이벤트 메타에 UTM/traffic source/landing path/ref 보강

추가 이벤트:

- `instagram_landing_view`
- `cases_cta_click`
- `order_lookup_from_instagram`

관련 migration:

- `202605130001_instagram_campaign_data_collection.sql`

검증:

- typecheck/build 통과
- 프로덕션 공개 경로 200 확인
- `/`, 인스타 UTM 홈, `/cases`, `/orders/lookup` 확인

## 15. 성능 최적화

`PERF_REPORT.md` 기준 진행 내용:

- `lib/perf.ts` 추가
- 주요 서버 데이터 로딩 지점에 `measure()` 계측
- Vercel 함수 로그에서 `[perf]` 라벨로 확인 가능
- `/admin/orders` select 축소, 20건 페이지네이션, 병렬 fetch
- `/admin/diagnoses` select 축소, page 기반 20건 페이지네이션
- `/admin/analytics` KPI/이벤트/판정/보증 집계 병렬화
- `/admin/technicians` 목록/주간 집계 병렬화
- `/admin/slots` slots/config/jobs 병렬 fetch
- `/quote/[serviceCode]` addon 조회 시 service item 중복 fetch 제거
- `/api/admin/orders` count 기반 페이지네이션 응답
- Supabase 운영 DB 인덱스 추가 및 `ANALYZE`

추가 인덱스:

- `idx_orders_status_created_at`
- `idx_orders_created_at`
- `idx_customers_phone_created_at`
- `idx_jobs_order_id`
- `idx_jobs_technician_scheduled_at`
- `idx_jobs_scheduled_at`
- `idx_reservations_reserved_date_time_slot`
- `idx_diagnoses_result_created_at`
- `idx_events_order_id_created_at`
- `idx_notifications_template_code_created_at` 또는 `idx_notifications_type_created_at`

관련 migration:

- `202605110007_perf_indexes.sql`

후속:

- Vercel `[perf]` 로그 1~2일 수집 후 800ms 이상 구간 튜닝
- `pg_stat_statements` 활성화 후 평균 실행시간 기반 인덱스 조정

## 16. 데이터 수집/엑셀 기준 평가

`EXCEL_STAGE_QA_REPORT.md` 기준 진행 내용:

### 16.1 Stage 평가

| Stage | 상태 | 요약 |
| --- | --- | --- |
| Stage 0 | 거의 완료 | 고객/집/주문/견적/결제/jobs/media/feedbacks/technicians/materials P0 골격 연결 |
| Stage 1 | 대부분 완료 | inspections, warranty_cases, 검수, A/S 흐름 연결 |
| Stage 2 | 부분 완료 | events, UTM, funnel/analytics, 슬롯 cap 구현. 광고/카카오/SMS 실연동은 약함 |
| Stage 3 | 미착수에 가까움 | memberships/코호트/혜택 흐름 없음 |
| Stage 4~5 | 일부 구조만 존재 | AI 사진 판정은 있으나 콘텐츠 트래픽/고급 AI 학습 운영은 후순위 |

### 16.2 카테고리별 상태

| 카테고리 | 상태 |
| --- | --- |
| 고객 프로필 | 완료 |
| 집 메타데이터 | 부분 완료 |
| 시공 의뢰 | 완료 |
| 견적·결제 | 완료 |
| 시공 실행 | 완료 |
| 시공 사진·영상 | 부분 완료 |
| 검수·품질 | 완료 |
| 고객 피드백 | 완료 |
| AS·하자 | 부분 완료 |
| 자재/매장 연동 | 구조 있음, 운영 미연결 |
| 위탁 시공자 | 부분 완료 |
| 마케팅 퍼널 | 부분 완료 |
| 콘텐츠 트래픽 | 미구현 |
| 멤버십 | 미구현 |
| AI 학습 메타 | 부분 완료 |

### 16.3 QA 중 발견/수정

- `/api/admin/orders?limit=5`에서 `reservations_1.reservation_date does not exist` 500 발견
- 실제 DB 기준 컬럼은 `reserved_date`
- `app/api/admin/orders/route.ts`, `app/admin/orders/page.tsx` 수정
- typecheck/build 통과
- Vercel 배포 후 `/api/admin/orders?limit=5` 200 재검증

## 17. UI/UX 검증 및 개선

### 17.1 전체 UI/UX 검증

`UI_UX_VERIFICATION.md` 기준:

- 고객 흐름 검증
- 공통 컴포넌트 검증
- 관리자 UI 검증
- 기사 앱 검증
- 발견 문제 수정
- 프로덕션 응답 확인
- 최종 빌드
- 주문 상태 문구/데이터 일치 검증

### 17.2 OrderStatus UX Quick Win

`UX_ORDER_STATUS_IMPLEMENTATION.md` 기준:

진행 내용:

- `lib/order-status-ux.ts` 추가
- 고객/관리자용 상태 라벨, 설명, A/S 가능 조건, 금지 전이 안내 단일 관리
- 고객 주문 상세에서 `completed` 상태의 A/S CTA 제거
- A/S 가능 조건 카드 추가 후 경량화 과정에서 `다음에 일어나는 일` 카드로 통합
- `completed`, `issue`, `warranty`, `done`별 primary CTA/copy 분리
- 견적/결제에서 결제 전 견적 범위, 포함 금액, 결제 후 일정 확정 흐름 명시
- 랜딩 예약 안내를 견적/결제/일정/최종 완료/A/S 조건 흐름으로 정리
- 관리자 주문 상세에 허용 다음 상태만 버튼으로 노출하는 상태 변경 패널 추가
- 금지 전이는 안내 문구로 표시

검증:

- `npm run typecheck` 통과
- `npm run build` 통과
- `node scripts\local-visual-qa.js` 통과
- 최종 캡처 기준 콘솔 에러 없음
- QA 주문 cleanup 완료

캡처:

- `screenshots/ux-order-status/landing-mobile.png`
- `screenshots/ux-order-status/landing-desktop.png`
- `screenshots/ux-order-status/quote-mobile.png`
- `screenshots/ux-order-status/quote-consult-mobile.png`
- `screenshots/ux-order-status/customer-completed-mobile.png`
- `screenshots/ux-order-status/customer-done-mobile.png`
- `screenshots/ux-order-status/admin-inquiry-desktop.png`
- `screenshots/ux-order-status/admin-completed-desktop.png`
- `screenshots/ux-order-status/admin-completed-mobile.png`
- `screenshots/ux-order-status/admin-done-desktop.png`
- `screenshots/ux-order-status/admin-scheduled-desktop.png`
- `screenshots/ux-order-status/admin-canceled-desktop.png`

### 17.3 홈/견적 예약 퍼널 분기

진행 내용:

- Buildus Care를 온디맨드 홈서비스 + 견적형 예약 + 작업 추적 + 재방문/A/S 하이브리드 플랫폼으로 정리
- 홈에서 서비스를 `즉시예약형`과 `상담/견적형`으로 분리
- Hero 1차 CTA는 사진 상담, 2차 CTA는 바로 예약 가능한 작업 보기로 조정
- 즉시예약형 견적은 가격 확인/일정 선택/결제 전면 배치
- 상담/견적형 견적은 사진/주소/요청사항 우선, 일정은 견적 확정 후 조율 문구로 축소
- `service.standardizable === true` 서비스에서만 일정 선택 적극 노출
- 모바일 sticky CTA는 요약 박스를 숨기고 결제 버튼만 고정

## 18. QA/배포/검증 기록

### 18.1 주요 QA 보고서

| 문서 | 내용 |
| --- | --- |
| `QA_REPORT.md` | 실제 운영 기준 고객 주문 현황 QA와 수정 내역 |
| `EXCEL_STAGE_QA_REPORT.md` | 엑셀 데이터 수집 단계 기준 QA |
| `QA_ORDER_STATUS_VERIFICATION.md` | 상태값 정리 후 QA |
| `UI_UX_VERIFICATION.md` | UI/UX 검증 |
| `ADMIN_DASHBOARD_REPORT.md` | 운영 대시보드 구현/검증 |
| `ORDER_CASES_ADMIN_EDIT_REPORT.md` | 주문조회/사례/관리자 수정 1차 보고 |
| `INSTAGRAM_TRAFFIC_UX_REPORT.md` | 인스타 유입 UX 보고 |
| `PERF_REPORT.md` | 성능 최적화 2차 보고 |

### 18.2 반복 검증 명령

여러 작업에서 반복 통과한 검증:

- `npm run typecheck`
- `npm run build`
- `node scripts\local-visual-qa.js`
- `$env:START_NEXT_SERVER='1'; node scripts\local-visual-qa.js`
- 프로덕션 URL HTTP 200 확인
- Supabase verification SQL 실행
- Vercel deployment READY 확인

### 18.3 프로덕션 배포 기록

대표 기록:

- Production URL: `https://buildus-care-flow.vercel.app`
- Phase 1 통합 검증/사례 배포: `dpl_C8f4rNpPBqCbpXDkegdENGqf63j4`
- 기사 모바일 앱 배포: `dpl_F6Sfdj4HyyVbs7gvXrfq6GdUqhFG`
- 관리자 주문 목록 수정 배포: `dpl_5nVTS1aCDqobo5HdA3FW654ZGTu5`
- 주문조회/사례/관리자 수정 배포: `dpl_3r9wEbrt4thkMgwVXvPPz18Tz4TN`
- 관리자 대시보드 배포: `dpl_Fj9VLteV33n6c63Shqf9CkAHWiwc`
- 인스타 유입 UX 배포: `dpl_DHoZ7a1UbXAUpjgkcxLmYVLS9ooR`

## 19. 전체 migration 목록

현재 `supabase/migrations`에 있는 파일:

```text
202605060001_init_backend_mvp.sql
202605060002_enable_rls.sql
202605060003_order_photo_storage.sql
202605070001_phase1_foundation.sql
202605070002_phase1_existing_table_expansion.sql
202605070003_phase1_data_backfill.sql
202605070004_phase1_indexes_rls.sql
202605070005_phase1_media_owner_xor.sql
202605070006_phase1_feedback_fields.sql
202605070007_phase1_jobs_operations.sql
202605070008_phase1_drop_legacy_tables.sql
202605070009_service_items.sql
202605070010_home_service_items.sql
202605070011_diagnoses.sql
202605080001_feedbacks_score_columns.sql
202605080002_warranty_cases_fields.sql
202605080003_technician_access_token.sql
202605080004_events_tracking.sql
202605080005_slots_config.sql
202605080006_reservation_slot_guard.sql
202605080006_slot_config_admin.sql
202605080007_reserve_order_slot_enum_fix.sql
202605080008_reservation_idempotency.sql
202605080009_reservation_phase1_order_status.sql
202605080010_reservation_remove_order_scheduled_date.sql
202605080011_p1_household_home_context.sql
202605110001_ai_diagnoses_columns.sql
202605110002_app_configs_launch_readiness.sql
202605110003_notification_settings.sql
202605110004_technician_region_note.sql
202605110005_auto_slot_cap_by_active_technicians.sql
202605110006_cancellations.sql
202605110007_perf_indexes.sql
202605110008_faqs_and_technician_profiles.sql
202605130001_instagram_campaign_data_collection.sql
202605130002_add_quoted_to_orders_status_check.sql
```

## 20. 전체 verification SQL 목록

현재 `supabase/verification`에 있는 파일:

```text
anthropic_diagnosis_checks.sql
cancellations_checks.sql
e2e_cleanup_launch_test.sql
instagram_campaign_data_collection_checks.sql
latest_order_for_screenshot.sql
launch_readiness_checks.sql
perf_indexes_checks.sql
phase_ai_diagnosis_preflight.sql
phase_launch_readiness_followup_checks.sql
phase_slots_active_tech_checks.sql
phase1_backfill_checks.sql
phase1_feedback_checks.sql
phase1_jobs_checks.sql
phase1_jobs_test_seed.sql
phase1_masking_cleanup_checks.sql
phase1_media_checks.sql
phase1_order_refactor_checks.sql
phase1_payment_checks.sql
phase1_quote_checks.sql
phase2_events_checks.sql
phase2_slots_checks.sql
phase2_slots_ux_checks.sql
phase2_trust_ux_checks.sql
phase3_technician_checks.sql
qa_customer_status_snapshot.sql
qa_recent_customer_phone.sql
ui_ux_verification_seed.sql
```

## 21. 주요 API 범위

### 21.1 고객/공개 API

- `GET /api/health`
- `GET /api/service-items`
- `GET /api/faqs`
- `POST /api/quote`
- `POST /api/quotes/:id/accept`
- `POST /api/orders`
- `GET /api/orders?phone=...`
- `POST /api/orders/lookup`
- `GET /api/orders/:id/status`
- `POST /api/orders/:id/reservation`
- `PATCH /api/orders/:id/reschedule`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/warranty`
- `POST /api/orders/:id/feedback`
- `POST /api/orders/:id/media/upload-url`
- `POST /api/orders/:id/media`
- `POST /api/orders/:id/photos/upload-url`
- `GET /api/orders/:id/photos`
- `POST /api/payments/toss/confirm`
- `POST /api/webhooks/toss`
- `GET /api/slots`
- `GET /api/reservations/slots`
- `GET /api/cases`
- `POST /api/diagnoses`
- `GET /api/diagnoses/:id`
- `POST /api/events`
- `GET /api/reviews`

### 21.2 관리자 API

- `POST /api/admin/auth`
- `POST /api/admin/logout`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status`
- `GET /api/admin/orders/export`
- `GET /api/admin/orders/unassigned-count`
- `GET /api/admin/jobs`
- `POST /api/admin/jobs`
- `GET/PATCH/DELETE /api/admin/jobs/:id`
- `PATCH /api/admin/jobs/:id/assign`
- `PATCH /api/admin/jobs/:id/start`
- `PATCH /api/admin/jobs/:id/complete`
- `PATCH /api/admin/jobs/:id/inspect`
- `PATCH /api/admin/jobs/:id/status`
- `POST /api/admin/jobs/:id/media/upload-url`
- `POST /api/admin/jobs/:id/media`
- `POST /api/admin/jobs/:id/report-video`
- `GET/POST/PATCH /api/admin/technicians`
- `PATCH /api/admin/technicians/:id/schedule`
- `GET/POST /api/admin/slot-configs`
- `PATCH/DELETE /api/admin/slot-configs/:date`
- `GET/POST /api/admin/faqs`
- `PATCH/DELETE /api/admin/faqs/:id`
- `PATCH /api/admin/faqs/:id/reorder`
- `GET /api/admin/feedbacks`
- `GET /api/admin/funnel`
- `GET /api/admin/analytics`
- `GET /api/admin/stats`
- `GET/PATCH /api/admin/settings`
- `POST /api/admin/cancellations/:id/approve`
- `POST /api/admin/cancellations/:id/reject`
- `GET /api/admin/events/export`
- `GET /api/admin/sessions/export`
- `GET/PATCH /api/admin/diagnoses/:id`

### 21.3 기사 API

- `POST /api/technician/auth`
- `GET /api/technician/jobs`
- `GET /api/technician/jobs/:id`
- `PATCH /api/technician/jobs/:id/start`
- `PATCH /api/technician/jobs/:id/complete`
- `POST /api/technician/jobs/:id/media/upload-url`
- `POST /api/technician/jobs/:id/media`

## 22. 주요 화면 범위

### 22.1 고객 화면

- `/`
- `/services`
- `/quote/[serviceCode]`
- `/orders/lookup`
- `/orders/[id]`
- `/request/photo`
- `/request/photo/result`
- `/cases`
- `/flow`
- `/lab/order-flow`
- `/lab/photo-upload`

### 22.2 관리자 화면

- `/admin/login`
- `/admin`
- `/admin/dashboard`
- `/admin/orders`
- `/admin/orders/[id]`
- `/admin/jobs`
- `/admin/jobs/[id]`
- `/admin/diagnoses`
- `/admin/technicians`
- `/admin/slots`
- `/admin/analytics`
- `/admin/funnel`
- `/admin/settings`
- `/lab/admin`

### 22.3 기사 화면

- `/technician/login`
- `/technician`
- `/technician/[jobId]`
- `/technician/[jobId]/checkin`
- `/technician/[jobId]/photos`
- `/technician/[jobId]/complete`

## 23. 운영 데이터/보안 정책

진행 내용:

- Supabase service role은 서버에서만 사용
- 고객 상태 조회는 access token 기반
- 고객 PII는 상태 API에서 마스킹
- 기사 주소/전화 원문 노출은 작업 24시간 전부터
- 관리자/기사 route는 middleware 보호
- 신규 Phase 1 테이블 RLS/FORCE RLS 활성화
- service role 전용 full access policy 적용
- webhook idempotency key로 중복 이벤트 방지
- 관리자 상태 변경/주문 수정은 events에 기록

주의:

- 실제 카카오/SMS/이메일 알림은 구조만 있고 운영 채널 연결 필요
- 환불/취소 자동화는 정책 확정과 Toss refund 연동 필요
- legacy 상태값 row가 남아 있을 수 있어 정리 migration 전에는 alias 처리 유지 필요

## 24. 문서 산출물

현재 루트 주요 문서:

- `README.md`
- `backend-spec.md`
- `phase1-implementation-brief.md`
- `phase1-migration-runbook.md`
- `phase1-deployment-report.md`
- `CHANGES_PHASE1.md`
- `PROJECT_ARCHITECTURE_OVERVIEW.md`
- `STATUS_CONSISTENCY_AUDIT.md`
- `IMPLEMENTATION_PLAN_ORDER_STATUS.md`
- `DB_ORDER_STATUS_CHECK_PLAN.md`
- `DEPLOY_ORDER_STATUS_ALIGNMENT.md`
- `QA_ORDER_STATUS_VERIFICATION.md`
- `QA_REPORT.md`
- `EXCEL_STAGE_QA_REPORT.md`
- `ADMIN_DASHBOARD_REPORT.md`
- `ORDER_CASES_ADMIN_EDIT_REPORT.md`
- `INSTAGRAM_TRAFFIC_UX_REPORT.md`
- `UI_UX_VERIFICATION.md`
- `UX_ORDER_STATUS_IMPLEMENTATION.md`
- `PERF_REPORT.md`
- `COMPETITOR_ANALYSIS.md`
- `ROADMAP.md`
- `docs_lazyweb_ui_refactor.md`
- `docs_phase1_*_test.md`
- `docs/order-status-mapping.md`
- `docs/order-account-roadmap.md`
- `docs/data_collection_schema.md`
- `docs/data_export_manual.md`
- `docs/lazyweb_executable_ux_plan.md`
- `docs/UI_UX_IMPLEMENTATION_FROM_LAZYWEB_P0.md`

## 25. 참고 산출물/로컬 흔적

프로젝트에는 아래 로컬 산출물도 남아 있다.

- `buildus_care_data.xlsx`
- `빌드어스_데이터수집매뉴얼_v1_2026-05-07.xlsx`
- `gg.html`, `gg2.html`, `gg3.html`
- `.next/`
- `.vercel/`
- `.lazyweb/`
- `.tmp-chrome-profile-2/`
- `.tmp-edge-profile/`
- `buildus-*.log`
- `dev-server.*.log`
- `ui-inspector-dev.*.log`
- `screenshots/`

이 중 `.next`, 로그, 임시 브라우저 프로필은 개발/검증 산출물이며 기능 소스는 아니다.

## 26. 남은 작업

우선순위가 높은 후속 작업:

1. 실알림 연결
   - 카카오 알림톡, SMS, 이메일 중 운영 채널 확정
   - 결제 완료, 예약 확정, 예약 변경, A/S 접수 알림 연결
   - `notifications` 큐와 실제 발송 provider 연결

2. 상태값/DB 정합성 최종 정리
   - legacy 주문 상태 데이터 cleanup
   - `cancelled -> canceled` 주문 row 정리
   - `completed`/`done`/`inspected` 작업-주문 의미 고정
   - 환불 상태 `refunded` 타입/UI 반영

3. 예약 변경 이력 화면
   - events에는 저장 중
   - 고객/관리자 화면에서 변경 이력 표시 필요

4. A/S 운영 고도화
   - responsibility, resolved_at, SLA, 처리 상태 화면 강화
   - A/S 별도 상세/목록 화면 검토

5. 자재/매장 연동
   - materials 운영 데이터 고도화
   - 도매가/재고/매장 SKU/자재 페어링 연결

6. 마케팅/콘텐츠/멤버십
   - 광고/카카오/GA 실데이터 연결
   - content_pages와 SEO 전환 추적
   - memberships, 쿠폰, 코호트, 재방문 혜택

7. AI 학습 운영
   - media angle/tags/ai label 운영 기준
   - 사진 판정 결과 품질 검수
   - 학습용 라벨링 파이프라인

8. QA 자동화 강화
   - 상태 전이 프로덕션 회귀 테스트
   - 예약/슬롯 DB 함수 회귀 테스트
   - 관리자 로그인 후 클릭 QA
   - 기사 실토큰 로그인/사진 업로드 실검증

## 27. 로드맵 기준

`ROADMAP.md` 기준:

| Phase | 상태 | 내용 |
| --- | --- | --- |
| Phase 1 | 완료 | 주문 전체 흐름, AI 사진 판정, Toss 결제, 관리자 UI, 기사 앱, 고객 주문 현황 |
| Phase 2 | 진행 중 | 신뢰 UX, 경쟁자 분석, FAQ, 기사 프로필 |
| Phase 3 | 다음 작업 | 예약 변경 1클릭, 시공 전 알림 자동화 |
| Phase 4 | 예정 | 쿠폰/할인 코드 |
| Phase 5 | 중기 | 여러 기사 견적 비교, 실시간 채팅, 기사 평점/후기, 시공 사진 실시간 공유 |
| Phase 6 | 장기 | AI 챗봇 상담, 구독/정기 관리, 커뮤니티/Q&A |

## 28. 최종 요약

현재 프로젝트는 Buildus Care 홈서비스 플랫폼의 MVP를 넘어 운영 가능한 프로덕션 프로토타입 수준까지 진행되어 있다. 고객은 서비스 탐색, 견적 입력, 예약, 결제, 주문 상태 조회, 예약 변경, 후기, A/S까지 사용할 수 있고, 관리자는 주문/작업/기사/슬롯/분석/설정/대시보드를 통해 운영할 수 있으며, 기사는 모바일 웹앱으로 현장 작업을 수행할 수 있다.

가장 큰 기술 자산은 Phase 1 데이터 모델 전환, 고객/관리자/기사 3자 플로우 연결, Supabase verification SQL, 상태값 감사 문서, 브라우저 시각 QA 스크립트, Vercel 배포 검증 기록이다.

가장 중요한 남은 과제는 실알림 연결, 상태값/legacy 데이터 정리, A/S/환불 운영 정책, 자재/매장 연동, 광고/콘텐츠/멤버십 고도화다.
