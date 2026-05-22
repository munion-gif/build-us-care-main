# BuildUS Care Lazyweb 실행형 UI/UX 설계안

작성일: 2026-05-13

Lazyweb 입력:

- 원본: `.lazyweb/buildus-ui-refactor-2026-05-08/lazyweb-results.json`
- 스크린샷: `.lazyweb/buildus-ui-refactor-2026-05-08/references/`
- 참고 보조 문서: `docs_lazyweb_ui_refactor.md`, `INSTAGRAM_TRAFFIC_UX_REPORT.md`

주의: 현재 세션의 MCP resource 목록에는 Lazyweb MCP가 직접 노출되지 않았다. 따라서 작업공간에 저장된 Lazyweb 결과 JSON과 레퍼런스 스크린샷을 기준으로 채택안을 정리했다.

## A. Executive Summary

추천 방향은 **"모바일 전환형 홈서비스 플로우: 작업 선택 → 안심 증거 → 견적 요약 → 주문 상태 확인"**이다.

BuildUS Care는 브랜드 소개 사이트가 아니라 광고/카카오/웹에서 들어온 고객이 빠르게 "내 문제를 해결할 수 있는지", "가격과 다음 단계가 안전한지", "결제 후 어디서 확인하는지"를 판단해야 하는 서비스다. 따라서 Taskrabbit식 서비스 탐색, Handybook식 즉시 견적 진입, Drumroll식 결제 전 요약, Microsoft/T-Mobile식 주문조회와 상태 안내를 조합하되, SaaS 랜딩식 긴 설명과 과한 대시보드 패턴은 배제한다.

핵심 실행 원칙:

- 첫 화면은 서비스 탐색보다 **문제 선택과 다음 행동**을 우선한다.
- 사례는 갤러리가 아니라 **비슷한 작업을 보고 견적/사진진단으로 이동하는 전환 장치**로 둔다.
- 견적 화면은 긴 폼이 아니라 **단계별 입력 + 항상 보이는 가격/방문 요약**으로 만든다.
- 주문상태 화면은 타임라인보다 먼저 **현재 상태, 다음 연락/방문, 고객 액션**을 보여준다.
- 모든 CTA는 기존 `source/campaign/region`, `sessionStorage`, 퍼널 이벤트를 유지한다.

## B. Reference Mapping Table

| 레퍼런스 | 적용 화면 | 가져올 패턴 | 채택 판단 | BuildUS Care 적용 |
|---|---|---|---|---|
| Taskrabbit property services | 홈 `/`, 서비스 카드 영역 | 서비스 카테고리 카드 + 우측 예약 절차 설명 | 채택 | `ServiceCard` 목록 옆/위에 `BookingGuidePanel`을 두고 "작업 선택 → 사진/주소 → 예약/결제"를 계속 노출 |
| Handybook plumbing quote | 홈, 견적 진입 | 서비스 상세 hero + 빠른 가격/견적 CTA | 부분 채택 | `HomeHero`와 `/quote/[serviceCode]` 상단에서 "정찰가 가능/사진 먼저 가능"을 명확히 표시. 긴 리드 폼은 비채택 |
| Drumroll checkout | 견적/주문 플로우, 결제 직전 | 입력 폼 + 우측/하단 Order Summary | 채택 | `PriceSummary`를 `QuoteSummaryCard`로 확장하고 모바일 sticky summary에 총액, 방문일, 선택 옵션, 결제 CTA 표시 |
| Yardbook quote button | 사례, 서비스 상세 | 특정 서비스에 바로 붙는 Get Quote CTA | 부분 채택 | 사례 카드와 서비스 카드에 "이 서비스 견적 보기"를 붙임. 관리자 임베드/설정 UI는 비채택 |
| T-Mobile order status | 주문조회 `/orders/lookup` | 주문 식별 정보 입력 + 기본/대체 조회 경로 | 채택 | 이름/전화번호 폼을 더 단순화하고, 최근 주문 카드에서 "상세 보기"를 주 CTA로 둠 |
| Microsoft order tracking | 주문상태 `/orders/[id]` | 계정/비회원 주문 관리 선택, FAQ/정책 보조 카드 | 채택 | accessToken 링크 진입 고객에게 "안전한 주문 링크/예약/AS" trust strip과 다음 액션 카드 제공 |
| Zara order incidents | 주문상태, A/S | 문제 발생 FAQ와 문의 CTA | 부분 채택 | `FeedbackPromptCard`, `WarrantyPromptCard` 아래에 "문제 있나요?" 액션을 노출. 좌측 도움말 내비는 비채택 |
| DoorDash local marketplace | 사례 `/cases` | 위치/필터 기반 카드와 sticky CTA | 부분 채택 | 지역/서비스 필터, 모바일 하단 `사진 판정/견적 보기` CTA 채택. 지도/배달비 정보는 비채택 |
| OnPhone onboarding | 사진진단 `/request/photo` | 짧은 온보딩 단계, 진행 dots, 단일 CTA | 채택 | 사진진단 4단계의 헤더를 더 압축하고 "사진 3장 → 연락처 → 결과"로 명확화 |
| Fiix/Alcove dashboard | 관리자/상태 참고 | KPI/상태 가시성 | P2 보류 | 이번 고객 전환 플로우에는 과함. 추후 admin analytics에만 참고 |

## C. Screen-by-Screen UX Plan

### 1. 홈 `/`

- 사용자 목표: 어떤 작업을 맡길 수 있는지 빠르게 보고, 견적 또는 사진진단으로 진입.
- 현재 유지: `HomeClient`, `ServiceCard`, `TrustBadges`, `CaseSamples`, `BottomCTA`, source-aware hero.
- 새 UI 패턴: Taskrabbit 서비스 카드 + 절차 패널, Handybook 빠른 견적 CTA, 모바일 sticky bottom CTA.
- 제거/약화: 큰 설명형 섹션, 검색 입력의 과한 우선순위. 인스타 유입에서는 검색보다 `사진으로 견적 받기` 우선.
- CTA 우선순위: `사진으로 견적 받기` > `서비스별 정찰가 보기` > `사례 보기`.
- 모바일 레이아웃: hero badge, 1문장 headline, CTA 1개, trust mini strip, 2열 service cards, bottom CTA.
- 좋은 이유: 광고 유입 고객이 "무엇을 누르면 되는지" 즉시 안다. `servicecardclick`, `diagnosisrequested`, `quotepageview`를 선명하게 만든다.

실행안:

- `HomeHero`를 명시 컴포넌트로 분리하고 source별 copy만 props로 바꾼다.
- `TrustBadges`는 홈 중간보다 hero 바로 아래 `TrustMiniStrip`으로 3개만 먼저 노출하고, 기존 4개 카드는 하단 유지.
- `ServiceCard`에는 `가격`, `예상 소요`, `상담 필요/정찰가` badge를 상단 우측으로 정렬한다.

### 2. 사례 `/cases`

- 사용자 목표: 내 집과 비슷한 사례를 보고 확신을 얻은 뒤 견적/사진진단으로 이동.
- 현재 유지: 필터, 사례 목록, selected detail, `CASES_CTA_CLICK`, source query 유지.
- 새 UI 패턴: DoorDash식 필터/카드, Yardbook식 카드별 Get Quote CTA, proof grid.
- 제거/약화: 사례 상세 감상형 텍스트. "잘했다"보다 "무슨 문제 → 어떤 작업 → 얼마/시간 → 다음 행동" 우선.
- CTA 우선순위: `이 서비스 견적 보기` > `사진 판정` > `서비스 전체 보기`.
- 모바일 레이아웃: 상단 필터 chips, 가로 스크롤 proof cards, 카드 하단 2 CTA, selected detail은 접이식 drawer.
- 좋은 이유: 사례가 전환을 막는 우회로가 아니라 quote/photo 진입의 근거가 된다.

실행안:

- `CaseProofCard` 신규: 지역, 서비스, 전/후 사진, 가격/시간, 핵심 작업 1줄.
- `CaseDetailDrawer` 신규: 모바일에서 선택 사례를 하단 drawer로 열고 CTA를 고정.
- 기존 `CaseSamples`는 홈 요약용으로 유지하되 실제 `/cases`와 같은 데이터 shape로 맞춘다.

### 3. 견적 진입 `/quote/[serviceCode]`

- 사용자 목표: 이 서비스가 내 상황에 맞는지, 가격이 어떻게 잡히는지 확인하고 입력을 시작.
- 현재 유지: serviceCode 기반, preset/source/campaign/region, quote draft sessionStorage.
- 새 UI 패턴: Handybook service hero + Drumroll step header.
- 제거/약화: 모든 정보를 한 번에 보여주는 긴 폼 첫인상.
- CTA 우선순위: `필수 정보 입력하고 견적 확정` > `사진 추가` > `카톡 상담`.
- 모바일 레이아웃: service header, price preview, 3-step progress, 첫 입력 섹션, sticky summary.
- 좋은 이유: `quotepageview`와 `quotestarted` 사이의 이탈을 줄이고, 사용자가 "얼마쯤이고 어디까지 입력해야 하는지" 이해한다.

실행안:

- `QuoteStepHeader` 신규: `기본 정보 / 집 정보 / 일정·사진 / 결제` 진행 표시.
- `QuoteServiceHero` 신규 또는 상단 inline 분리: service name, 정찰가 여부, 예상 시간, A/S badge.
- `QuoteTrustNote` 신규: "결제 전 총액 확인", "사진은 선택이지만 빠른 확인에 도움" 같은 짧은 안내.

### 4. 견적/주문 플로우

- 사용자 목표: 필수 정보를 빠짐없이 입력하고, 옵션/사진/날짜를 이해한 뒤 주문 생성.
- 현재 유지: `AddonSelector`, `PhotoUploader`, 주소 모달, 날짜 선택, `createOrderAndQuote`.
- 새 UI 패턴: Drumroll checkout의 좌측 단계 폼 + 우측 요약.
- 제거/약화: 독립 카드가 너무 많아 흐름이 끊기는 느낌. 중첩 카드 금지.
- CTA 우선순위: 현재 단계 저장/다음 > 결제 준비 > 카톡 상담.
- 모바일 레이아웃: 각 단계는 한 화면에 하나씩, sticky footer에 `총액 + 다음 버튼`.
- 좋은 이유: `quotesubmitted`, `ordercreated`는 서버 시점에서 정확히 발생해야 하므로 UI는 중복 제출 방지와 단계 이해를 돕는다.

실행안:

- `QuoteFormSection` 신규: 제목, 완료 상태, 필수/선택 label 규칙 통일.
- `QuoteStickySummary` 신규: 총액, 선택 날짜, 사진 수, 주 CTA.
- `AddonSelector`는 체크박스 row를 유지하되 "선택 사항"과 금액 변화 표시를 더 분명히 한다.

### 5. 결제 직전 요약

- 사용자 목표: 결제 전 최종 금액, 방문일, 작업 범위, 환불/AS 기준을 확인.
- 현재 유지: `PriceSummary`, mock/Toss 결제 흐름, `PAYMENT_STARTED`, `payment_done`.
- 새 UI 패턴: Drumroll Order Summary.
- 제거/약화: 가격 라인만 있고 "결제하면 무엇이 확정되는지"가 약한 상태.
- CTA 우선순위: `결제하고 예약 확정` 단일 primary. 보조는 `견적 다시 확인`.
- 모바일 레이아웃: sticky bottom expanded summary, 결제 버튼은 하단 고정.
- 좋은 이유: 결제 전 불안을 낮추고 `paymentstarted`를 더 의도적인 액션으로 만든다.

실행안:

- `QuoteSummaryCard` 신규/확장: 작업명, 자재 등급, 옵션, 출장비, 총액, 예약일, 사진 수, A/S 기준.
- 결제 버튼 직전 copy: "결제 후 주문 링크에서 기사 배정과 방문 상태를 확인할 수 있어요."
- mock 결제/실결제 모두 UI 이벤트는 `paymentstarted`; 완료는 서버 confirm의 `payment_done`으로 단일화.

### 6. 주문조회 `/orders/lookup`

- 사용자 목표: 주문 링크를 잃어버렸거나 재방문한 고객이 빠르게 주문을 찾음.
- 현재 유지: 이름/전화번호 조회, 인스타 유입 안내, `order_lookup`.
- 새 UI 패턴: T-Mobile lookup form + Microsoft guest order pattern.
- 제거/약화: 긴 설명. 조회 전에는 입력 2개와 안심 문구만.
- CTA 우선순위: `주문내역 조회` > `카톡 문의` > `새 견적 시작`.
- 모바일 레이아웃: full-width lookup card, 결과는 최신순 card stack, 각 card에 `주문 상세 보기`.
- 좋은 이유: 기존 고객이 헤매지 않고 `order_lookup` 후 `status_view`로 이어진다.

실행안:

- `OrderLookupSearchForm` 유지/분리: name, phone, submit.
- `OrderLookupResultCard` 신규: 주문번호, 서비스명, 상태 badge, 예약/결제 요약, 상세 CTA.
- 조회 실패 상태에 `새 견적 시작` 대신 먼저 `전화번호 확인` 안내, 그 다음 보조 CTA.

### 7. 주문상태 `/orders/[id]`

- 사용자 목표: 지금 상태와 다음 일을 알고, 예약 변경/취소/AS/피드백을 처리.
- 현재 유지: `StatusTimeline`, `QuoteSummary`, `ReservationCard`, `FeedbackModal`, warranty/cancel/reschedule actions, accessToken.
- 새 UI 패턴: Microsoft order management, Zara incident support, T-Mobile status clarity.
- 제거/약화: 타임라인을 첫 정보로 두는 구조. 현재 상태 요약이 먼저 와야 함.
- CTA 우선순위: 상태별 1개 primary. 예: 결제 완료 후 `방문 일정 확인`, 완료 후 `후기 남기기`, 문제 시 `A/S 접수`.
- 모바일 레이아웃: current status panel, next action card, timeline, reservation/quote, aftercare.
- 좋은 이유: `status_view`의 의미가 단순 조회가 아니라 안심/후속 행동으로 이어진다.

실행안:

- `OrderCurrentStatusPanel` 신규: 상태 label, 설명, 다음 예상 액션/시간.
- `NextActionCard` 신규: 상태별 primary CTA 1개와 secondary 1개.
- `StatusTimeline`은 현재 유지하되 `current summary`는 panel로 이동하거나 중복 제거.
- `WarrantyPromptCard` 신규: 완료/문제 상태에서 A/S 접수와 카톡 문의를 짧게 제시.

### 8. 사진진단 `/request/photo`, `/request/photo/result`

- 사용자 목표: 어떤 작업인지 몰라도 사진을 올리고 교체/보류/불필요/현장확인 결과를 받음.
- 현재 유지: 4-step flow, service selection, photo slots, contact, diagnosis API, `diagnosisrequested`.
- 새 UI 패턴: OnPhone onboarding dots + Taskrabbit category selection.
- 제거/약화: "AI" 강조보다 고객 입장의 결과/다음 행동 우선.
- CTA 우선순위: `사진 판정받기` > 결과별 `견적 받기/상담하기/사진 다시 올리기`.
- 모바일 레이아웃: progress bar, 한 단계 한 질문, photo guide 3 tiles, result summary card.
- 좋은 이유: 진단은 광고 유입의 낮은 부담 CTA이므로 `diagnosisrequested`를 견적 전환의 보조 퍼널로 만든다.

실행안:

- `DiagnosisUploadPanel` 유지/분리: service select + photo guide + slots.
- `DiagnosisResultSummary` 신규: 결과 badge, 이유 1줄, 신뢰도, 다음 CTA.
- 결과 CTA에 `appendSourceParams`를 적용해 quote 진입 시 source/campaign 유지.

## D. Component Plan

### 기존 컴포넌트 유지

- `components/home/ServiceCard.tsx`: 유지, badge/CTA density 개선.
- `components/home/TrustBadges.tsx`: 유지, hero 아래 `TrustMiniStrip` 신규와 역할 분리.
- `components/home/CaseSamples.tsx`: 유지, 홈 요약용 proof card로 개선.
- `components/quote/AddonSelector.tsx`: 유지, 선택/금액 변화 가시성 강화.
- `components/quote/PhotoUploader.tsx`: 유지, photo guide slot과 연결.
- `components/quote/PriceSummary.tsx`: 유지하되 `QuoteSummaryCard`로 확장 대상.
- `components/orders/StatusTimeline.tsx`: 유지, 상세 위치를 status panel 아래로 조정.
- `components/orders/QuoteSummary.tsx`, `ReservationCard.tsx`, `FeedbackModal.tsx`: 유지.

### 수정 대상 컴포넌트

| 우선순위 | 대상 | 변경 |
|---|---|---|
| P0 | `app/home-client.tsx` | `HomeHero`, `TrustMiniStrip`, service CTA order 정리 |
| P0 | `app/quote/[serviceCode]/quote-detail-client.tsx` | `QuoteStepHeader`, `QuoteStickySummary`, 결제 전 summary 강화 |
| P0 | `app/orders/[id]/order-status-client.tsx` | current status panel, next action card, AS/feedback prompt 순서 정리 |
| P0 | `app/orders/lookup/order-lookup-client.tsx` | lookup form/results card 명확화 |
| P1 | `app/cases/cases-client.tsx` | proof card, mobile detail drawer, CTA 고정 |
| P1 | `app/request/photo/photo-request-client.tsx` | source-aware copy, 결과 CTA source 유지 |
| P1 | `app/request/photo/result/photo-result-client.tsx` | result summary card, quote link source 유지 |
| P2 | `app/admin/*` | field-service dashboard 레퍼런스는 고객 플로우 후 적용 |

### 신규 제안 컴포넌트

- P0 `HomeHero`
- P0 `TrustMiniStrip`
- P0 `BookingGuidePanel`
- P0 `QuoteStepHeader`
- P0 `QuoteSummaryCard`
- P0 `QuoteStickySummary`
- P0 `OrderCurrentStatusPanel`
- P0 `NextActionCard`
- P0 `OrderLookupResultCard`
- P1 `CaseProofCard`
- P1 `CaseDetailDrawer`
- P1 `DiagnosisUploadPanel`
- P1 `DiagnosisResultSummary`
- P1 `WarrantyPromptCard`

## E. Copy Guide

### 홈 hero

- instagram: "사진만 보내도, 우리 집 교체 가능 여부부터 확인해드려요"
- kakao: "상담 이어서 진행할 작업을 선택해주세요"
- direct/web: "교체·수리, 가격 확인부터 예약까지 한 번에"
- organic: "우리 집과 비슷한 작업을 찾고 정찰가를 확인하세요"

### 서비스 카드

- "변기 교체"
- "정찰가 가능"
- "215,000원~"
- "철거·설치·누수 테스트 포함"
- "약 45분"

### 사례 CTA

- "이 서비스 견적 보기"
- "사진으로 내 상황 확인"
- "비슷한 사례 더 보기"

### 견적 시작 버튼

- "필수 정보 입력하고 견적 확정"
- "사진 추가하고 더 정확히 보기"
- "결제하고 예약 확정"

### 결제 직전 안내

- "결제 후 주문 링크에서 기사 배정과 방문 상태를 확인할 수 있어요."
- "현장 조건이 달라 추가 비용이 필요한 경우, 작업 전 먼저 안내합니다."
- "시공 완료 후 A/S 접수도 같은 주문 링크에서 가능합니다."

### 주문상태 다음 단계 안내

- `paid`: "결제가 완료됐어요. 기사 배정 후 방문 일정을 안내드릴게요."
- `scheduled`: "방문 일정이 확정됐어요. 변경이 필요하면 아래에서 요청하세요."
- `in_progress`: "작업이 진행 중이에요. 완료 후 사진과 상태가 업데이트됩니다."
- `done/completed`: "작업이 완료됐어요. 불편한 점이 있으면 A/S를 접수해주세요."
- `warranty`: "A/S가 접수됐어요. 담당자가 확인 후 연락드립니다."

### A/S 또는 재문의 CTA

- "A/S 접수하기"
- "문제 사진 보내기"
- "카톡으로 문의하기"
- "다른 작업 견적 보기"

## F. Implementation Notes

### 라우트별 변경 포인트

- `/`: `HomeClient` 안의 hero/service/guide를 컴포넌트로 분리. `appendSourceParams` 유지. `SERVICE_CARD_CLICK` onClick 유지.
- `/cases`: 모든 quote/photo href에 `appendSourceParams` 유지. `CASES_CTA_CLICK` target 값을 `quote/photo/services`로 유지.
- `/quote/[serviceCode]`: `preset.source/campaign/region`, `getUtmParams`, `getSessionId`, draft/sessionStorage key를 건드리지 않는다. UI만 단계/summary로 재배치한다.
- `/orders/lookup`: 조회 submit 시 `ORDER_LOOKUP_FROM_INSTAGRAM` 또는 정규 `order_lookup` 이벤트 유지. 결과 card의 상세 링크는 서버가 내려주는 accessToken 링크 그대로 사용.
- `/orders/[id]`: accessToken validation 흐름 변경 금지. status API가 이미 `status_view`를 찍으므로 클라이언트 중복 tracking 추가 금지.
- `/request/photo`: `DIAGNOSIS_REQUESTED`는 submit 성공 후 1회만. 결과 quote 링크에 source params를 붙인다.

### 채널별 가변 전략

| source | hero copy | CTA prominence | trust block order |
|---|---|---|---|
| instagram | 사진/정찰가/빠른 확인 | `사진으로 견적 받기` 1순위 | 실제 사례 → 정찰가 → A/S |
| kakao | 상담 이어가기 | `상담 내용으로 견적 이어가기` 1순위 | 상담 연속성 → 주문 링크 → A/S |
| direct | 서비스 탐색 | `서비스 고르기`와 `사진 판정` 병렬 | 정찰가 → 작업 기록 → A/S |
| organic | 정보 탐색 후 전환 | `비슷한 사례 보기`와 `정찰가 확인` | 사례 → 가격 기준 → FAQ |

### 퍼널/이벤트 유지

- `servicecardclick`: `ServiceCard` click handler 유지. 카드 안에 중첩 button 금지.
- `quotepageview`: `/quote/[serviceCode]` 진입 시 유지.
- `quotestarted`: quote page boot 또는 첫 입력 시작 시 1회. 중복 방지 필요.
- `quotesubmitted`: 서버 `/api/orders` 시점 유지. UI에서 별도 중복 이벤트 금지.
- `ordercreated`: 주문 생성 성공 후 클라이언트에서 유지 가능하되 `quote_submit`과 분석 목적 구분.
- `paymentstarted`: 결제 버튼 클릭 후 결제창/mock confirm 진입 직전 유지.
- `paymentcompleted`: 서버 confirm의 `payment_done` 단일 기준. 클라이언트 완료 중복 지양.
- `diagnosisrequested`: 사진진단 API 성공 후 1회.

## G. QA Checklist

### 모바일

- 360px 폭에서 hero CTA, service card price, sticky summary text가 줄바꿈되어도 겹치지 않는다.
- bottom CTA와 sticky quote summary가 동시에 떠서 충돌하지 않는다.
- quote flow에서 날짜 선택, 사진 업로드, 결제 버튼이 한 손 조작 범위에 있다.
- order status에서 현재 상태와 다음 액션이 첫 화면 안에 보인다.

### source 유지

- `/?utm_source=instagram&utm_campaign=suwon_toilet_fixed_price` 진입 후 `/cases`, `/request/photo`, `/quote/[serviceCode]` 링크에 source/campaign이 유지된다.
- quote submit payload에 `session_id`, `utm_source`, `utm_campaign`, `landing_path`, `device_type`, `region_code`가 유지된다.

### sessionStorage 유지

- `buildus_source_context`가 UTM 없는 내부 이동에서도 유지된다.
- quote draft key `buildus:quote-draft:${serviceCode}`가 UI 분리 후에도 유지된다.
- payment draft key `buildus:quote-payment:${serviceCode}`가 결제 재시도에서 깨지지 않는다.

### CTA 노출

- 홈 첫 화면에 primary CTA 1개 이상.
- 사례 카드마다 quote/photo CTA.
- 견적 화면 sticky footer에 다음/결제 CTA.
- 주문조회 결과 card마다 상세 보기 CTA.
- 주문상태에는 상태별 next action CTA 1개.
- 사진진단 결과에는 결과별 CTA 1개 이상.

### 퍼널 이벤트

- `servicecardclick`: 서비스 카드 클릭 1회.
- `quotepageview`, `quotestarted`: quote 진입 1회.
- `quotesubmitted`, `ordercreated`: 주문 생성 시점 확인.
- `paymentstarted`, `payment_done`: 결제 시작/confirm 성공 분리.
- `diagnosisrequested`: 사진진단 성공 1회.
- `status_view`: status API 조회 시 1회, 클라이언트 중복 없음.

### 주문상태 안심감

- accessToken 없는 링크는 안전하게 오류 안내.
- paid/scheduled/done/warranty/canceled 상태별 다음 문구가 다르다.
- A/S/취소/예약변경 액션은 가능한 status에서만 보인다.
- 개인정보 마스킹은 기존 status API 정책을 유지한다.

