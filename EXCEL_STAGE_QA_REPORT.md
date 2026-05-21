# EXCEL Stage QA Report

검증일: 2026-05-12  
검증 환경: Production `https://buildus-care-flow.vercel.app`  
기준 문서: `빌드어스_데이터수집매뉴얼_v1_2026-05-07.xlsx`  
원칙: 테스트 데이터만 사용, 실카드 결제 제외, 차단 버그만 최소 수정

## 1. 엑셀 기준 현재 상태 요약

### Stage 0~5 평가

| Stage | 엑셀 정의 | 현재 상태 | 판단 근거 |
|---|---|---|---|
| Stage 0 | customers, homes, orders, quotes, payments, jobs, media, feedbacks, technicians, materials P0 스켈레톤 및 핵심 필드 | 거의 완료 | 주문 생성, 예약, 견적, mock 결제, 주문 상태 조회가 프로덕션 테스트 주문으로 통과했다. P0 핵심 테이블과 API가 대부분 존재하며, `service_items`, 슬롯, 결제 상태까지 실제 플로우에 연결되어 있다. 단, materials는 데이터 구조는 있으나 매장/재고 운영 연동은 아직 약하다. |
| Stage 1 | inspections, warranty_cases, 기본 검수 체크리스트, 표준 사진 앵글 | 대부분 완료 | 관리자/기사 API에 시작/완료/검수, 고객 A/S 접수, warranty 상태 전환이 연결되어 있다. 다만 표준 사진 앵글과 검수 데이터 품질은 실제 현장 누적이 더 필요하다. |
| Stage 2 | events, UTM, 광고 채널 정밀화, 자재 페어링, ROI 측정 | 부분 완료 | `events` API, UTM 저장, funnel/analytics, 슬롯 cap과 기사 수 연동이 구현되어 있다. 실제 광고/카카오/SMS 유입과 운영 알림 연결은 아직 약해 ROI 측정은 구조 중심 단계다. |
| Stage 3 | memberships, 코호트, NPS 자동 집계, 시공자 매칭 시드 | 미착수에 가까움 | technicians에는 NPS/통과율/스케줄 지표 구조가 있으나 멤버십 테이블/화면/혜택/코호트 기능은 실사용 흐름이 없다. |
| Stage 4~5 | content_pages, SEO 전환 추적, AI 학습 라벨링, 고급 자동화 | 일부 구조만 존재 | AI 사진 판정과 diagnoses는 연결되어 있으나 콘텐츠 트래픽 테이블, content_pages, media angle/AI label 운영, 고급 AI 학습 파이프라인은 아직 후순위 상태다. |

### 15개 카테고리별 상태

| 카테고리 | 상태 | 근거 |
|---|---|---|
| 고객 프로필 | 완료 | `customers`에 phone/name/address/acquisition/UTM/household 일부가 저장된다. 전화번호 기반 주문 조회도 존재한다. |
| 집 메타데이터 | 부분 완료 | `homes`에 size/building/year/floor/complex 일부가 있다. 다만 단지 ID/층수 활용, 단지 마케팅 연결은 아직 약하다. |
| 시공 의뢰 | 완료 | `orders.skus`, reason/urgency/self_diagnosis, inquiry photos snapshot, photo media API가 있다. |
| 견적·결제 | 완료 | quote 생성/수락, Toss mock confirm, payments `done`, orders `paid` 전환이 프로덕션 테스트에서 통과했다. |
| 시공 실행 | 완료 | jobs scheduled/start/complete/inspect, expected/actual minutes, materials_used 입력 경로가 있다. 실제 현장 데이터 누적은 더 필요하다. |
| 시공 사진·영상 | 부분 완료 | before/during/after/material/issue 업로드 API와 기사 앱 사진 화면이 있다. 표준 앵글/영상 운영 규칙은 아직 약하다. |
| 검수·품질 | 완료 | inspections checklist, passed, admin inspect API/모달이 구현되어 있다. |
| 고객 피드백 | 완료 | NPS 필수, 5축 점수, 재추천/재의뢰 의사, 중복 제출 방지가 구현되어 있다. |
| AS·하자 | 부분 완료 | warranty_cases, 고객 A/S 신청, status warranty가 있다. 책임 분담/해결 SLA 운영 화면은 더 필요하다. |
| 자재(매장 연동) | 구조는 있으나 운영 미연결 | materials/service_items와 materials_used 구조는 있으나 실제 도매가/재고/입고/매장 SKU 운영은 미연결이다. |
| 위탁 시공자 | 부분 완료 | technicians, access_token, 기사 앱, active cap 연동, 프로필 필드가 있다. 등급/NPS/pass_rate 자동 집계는 아직 약하다. |
| 마케팅 퍼널 | 부분 완료 | events, UTM, analytics/funnel 화면이 있다. 실제 광고 플랫폼/카카오 채널 데이터와 자동 연결은 미완성이다. |
| 콘텐츠 트래픽 | 미구현 | SEO 페이지와 cases는 있으나 콘텐츠별 PV/키워드/전환 추적 테이블과 운영 화면은 없다. |
| 멤버십 | 미구현 | memberships 실사용 테이블/화면/혜택 흐름이 없다. |
| AI 학습 메타 | 부분 완료 | Claude 사진 판정과 diagnoses 저장은 있다. media angle/tags/ai_detected의 체계적 라벨 운영은 부족하다. |

### P0 / P1 / P2 누락

| 우선순위 | 항목 | 현재 상태 | 조치 필요 |
|---|---|---|---|
| P0 | 대표 전화/카카오/실알림 | app_configs와 설정 UI는 있음 | 실제 카카오/SMS/이메일 발송 키와 운영 채널 연결 필요 |
| P0 | 관리자 주문 목록 안정성 | QA 중 500 발견 | `reservation_date` 구 컬럼 참조 제거 후 배포, 재검증 200 |
| P0 | 기사 현장 데이터 누적 | 앱/API는 있음 | 실제 기사 토큰 배포와 현장 사용 교육 필요 |
| P1 | 예약 변경 이력 | 셀프 변경 이벤트는 저장 | 고객/관리자용 변경 이력 화면은 없음 |
| P1 | AS 책임/해결 SLA | warranty_cases 존재 | responsibility/resolved_at 운영 처리 UI 보강 필요 |
| P1 | 마케팅 funnel 정교화 | events/UTM 존재 | 광고/카카오/GA 연계와 채널별 실데이터 확보 필요 |
| P1 | materials 재고/페어링 | 구조 일부 | 매장/재고/도매가 운영 연동 필요 |
| P2 | memberships | 미구현 | 후순위 |
| P2 | content_pages/SEO 전환 | 미구현 | 후순위 |
| P2 | media.angle / AI label | 일부 스키마/판정만 있음 | 학습용 라벨링 운영 기준 필요 |

## 2. QA 결과

### 고객 플로우

| 항목 | 결과 | 근거 |
|---|---|---|
| `/` | PASS | Production 200 |
| `/services` | PASS | Production 200 |
| `/quote/toilet_replace` | PASS | Production 200 |
| `/request/photo` | PASS | Production 200 |
| `/orders/lookup` | PASS | Production 200 |
| `/orders/[id]?accessToken=...` | PASS | 테스트 주문 페이지 200 |
| `/api/health` | PASS | 200, `supabaseConfigured=true`, `paymentMockMode=true` |
| `/api/service-items` | PASS | 200, database source |
| `/api/slots?year=2026&month=5` | PASS | 200, capSource `active_technicians`, maxCount 2 |
| `/api/faqs` | PASS | 200, FAQ 데이터 반환 |

### 주문/결제/상태 QA

테스트 데이터:

| 항목 | 값 |
|---|---|
| 주문번호 | `BO-20260512-0001` |
| 주문 ID | `6ba18ae7-222d-449c-83d2-70b4de00db4c` |
| 테스트명 | 결제검증 |
| 전화번호 | `010****6255` |
| 결제 방식 | mock confirm |
| 후처리 | 테스트 주문으로 남아 있음. 운영 지표에서 제외하려면 추후 정리 필요 |

검증 결과:

| 단계 | 결과 | 비고 |
|---|---|---|
| 주문 생성 | PASS | `POST /api/orders` 201 |
| 예약 생성 | PASS | `POST /api/orders/:id/reservation` 201 |
| 견적 생성 | PASS | `POST /api/quote` 200 |
| 견적 수락 | PASS | `POST /api/quotes/:id/accept` 200 |
| mock 결제 confirm | PASS | `POST /api/payments/toss/confirm` 200 |
| 상태 조회 | PASS | `GET /api/orders/:id/status` 200 |
| DB 상태 | PASS | `orders.status=paid`, `payments.status=done`, `provider_status=DONE`, `quote.accepted_at` 존재 |

상태 문구 기준:

| 상태 조합 | 결과 | 근거 |
|---|---|---|
| paid + job 없음 | PASS | `lib/order-status-label.ts`에서 “결제 완료, 기사 배정 중” |
| paid/scheduled + job scheduled | PASS | “방문 예약 확정” |
| in_progress | PASS | “시공 중” |
| completed | PASS | “시공 완료, 검수 중” |
| done | PASS | “시공 완료” |
| warranty | PASS | “A/S 접수됨” |

### 예약 변경 QA

| 시나리오 | 결과 | 근거 |
|---|---|---|
| 정상 변경 | PASS | 테스트 주문 `2026-05-26 afternoon` 변경 200 |
| 동일 슬롯 멱등 | PASS | 동일 요청 재호출 200, `idempotent=true`, `jobAction=kept` |
| 마감/차단 슬롯 차단 | PASS | 임시 `slot_configs` 차단 후 409 `SLOT_CLOSED`, cleanup 완료 |
| 기사 유지 가능 | PASS | scheduled job 배정 후 변경 200, `jobAction=updated`, `jobs.scheduled_at=2026-06-11T04:00:00Z` |
| 기사 유지 불가/해제 | PASS | 기존 job 재배정 필요 케이스에서 `jobAction=released`, orders `paid` 복원 |
| 시작된 작업 변경 차단 | PASS | in_progress job 상태에서 409, 변경 차단 확인 |
| 이벤트 저장 | PASS | `events.event_type=reservation_rescheduled`, properties에 from/to/job_action 저장 |

주의: 날짜형 컬럼은 DB client에서 UTC ISO로 보일 수 있어 `reserved_date=2026-05-25T15:00:00Z`처럼 표시되지만 KST 기준 `2026-05-26`이다.

### 관리자 QA

| 경로/기능 | 결과 | 근거 |
|---|---|---|
| `/admin/login` | PASS | Production 200 |
| 보호 라우트 redirect | PASS | `/admin/orders`, `/admin/slots`, `/admin/technicians`, `/admin/analytics`, `/admin/diagnoses`, `/admin/settings` 모두 쿠키 없이 `/admin/login` 307 |
| `/api/admin/orders?limit=5` | ISSUE -> FIXED | 최초 500: `reservations_1.reservation_date does not exist`. 구 컬럼 참조 제거 후 배포, 재검증 200 |
| `/api/admin/stats` | PASS | 200, todayOrders/todayPaid/weekRevenue 등 반환 |
| `/api/admin/analytics?period=week` | PASS | 200, orders/diagnoses/funnel 반환 |
| `/api/admin/technicians` | PASS | 200, 기사 목록 반환 |
| `/api/admin/slot-configs` | PASS | 200, cap 2, active technician 연동 |

관리자 UX 관찰:

- 주문/슬롯/기사/분석/설정 화면은 존재하고 보호된다.
- 슬롯 cap은 active technicians 기준으로 작동한다.
- 관리자 주문 목록은 이번 QA 중 발견한 500을 수정/배포했다.
- 실제 로그인 후 화면 클릭 QA는 자동화하지 못했고, API/redirect/코드 구조 중심으로 확인했다.

### 기사 앱 QA

| 경로/기능 | 결과 | 근거 |
|---|---|---|
| `/technician/login` | PASS | Production 200 |
| 보호 라우트 redirect | PASS | `/technician`, `/technician/test-job` 쿠키 없이 `/technician/login` 307 |
| 기사 인증 API | PASS(구조) | `/api/technician/auth`가 access_token과 active 상태 검증 |
| 오늘 작업 목록 API | PASS(구조) | `/api/technician/jobs`가 tech_session 기반으로 assigned jobs 반환 |
| 시작/완료/사진 업로드 API | PASS(구조) | start/complete/media/upload-url route 존재 |

기사 앱 실토큰 로그인과 실제 사진 업로드는 운영 기사 토큰/파일 선택이 필요해 코드/라우트 기준으로 확인했다.

## 3. UX 이슈

### 고객 UX

| 이슈 | 심각도 | 내용 |
|---|---|---|
| 견적 페이지 입력량이 많아 중도 이탈 가능 | 중간 | 엑셀 P0/P1 필드를 많이 수집하도록 설계되어 있어, 고객 입장에서는 주소/집정보/일정/결제 흐름이 길게 느껴질 수 있다. 단계별 저장/진행률과 선택 입력의 부담 완화가 중요하다. |
| 결제 후 테스트 주문은 paid 상태로 “기사 배정 중”에 머무름 | 낮음 | 상태 문구 자체는 맞지만, 실제 운영에서는 기사 배정 SLA나 예상 배정 시간이 같이 보여야 불안감이 줄어든다. |
| 예약 변경 성공 후 기사 재배정 여부 안내가 더 명확해야 함 | 중간 | `jobAction=released`일 때 안내 문구는 있으나, 고객 입장에서 “언제 다시 안내되는지”가 더 구체적이면 좋다. |

### 관리자 UX

| 이슈 | 심각도 | 내용 |
|---|---|---|
| 관리자 주문 목록이 DB 컬럼 변경에 취약했음 | 높음 | `reservation_date` 구 컬럼 참조로 500이 발생했다. 이번에 수정했지만 예약/주문 테이블 컬럼명은 회귀 테스트가 필요하다. |
| “오늘 해야 할 일”이 분산됨 | 중간 | 주문, 슬롯, jobs, analytics가 나뉘어 있어 미배정 paid 주문/오늘 방문/취소 요청을 한 화면에서 보는 운영 대시보드가 더 필요하다. |
| 설정값은 있으나 실알림 운영 연결이 약함 | 중간 | 카카오 URL, 관리자 이메일/전화, notify_channel 구조는 있지만 실제 알림 발송 운영 상태는 별도 확인이 필요하다. |

### 기사 UX

| 이슈 | 심각도 | 내용 |
|---|---|---|
| 토큰 기반 로그인은 운영 배포/관리 UX가 필요 | 중간 | 기사 앱 구조는 있으나 기사에게 토큰을 어떻게 전달/재발급/회수할지 운영 화면이 더 필요하다. |
| 현장 입력은 30초 원칙에 근접하지만 자재 입력은 무거울 수 있음 | 낮음 | 사진 업로드와 완료 보고는 분리되어 있으나 materials_used 수량/추가자재 입력은 현장에서는 더 단순화할 여지가 있다. |

## 4. 최소 수정 내역

| 문제 | 영향도 | 수정 파일 | 수정 이유 | 재검증 결과 |
|---|---|---|---|---|
| `/api/admin/orders?limit=5` 500: `reservations_1.reservation_date does not exist` | 높음 | `app/api/admin/orders/route.ts`, `app/admin/orders/page.tsx` | 실제 DB는 `reserved_date` 기준인데 구 컬럼 `reservation_date`를 select하고 있어 관리자 주문 목록/API를 막음 | `npm run typecheck` PASS, `npm run build` PASS, Vercel 배포 `dpl_5nVTS1aCDqobo5HdA3FW654ZGTu5`, 프로덕션 `/api/admin/orders?limit=5` 200 |

## 5. 다음 우선순위 3개

1순위: 관리자 운영 대시보드 정렬  
2순위: 실알림 연결(카카오/SMS/이메일)  
3순위: 마케팅 퍼널/콘텐츠/멤버십 고도화
