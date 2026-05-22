# Lazyweb P0 UI/UX Implementation

## 수정한 파일

- `app/home-client.tsx`
- `app/quote/[serviceCode]/quote-detail-client.tsx`
- `app/orders/[id]/order-status-client.tsx`
- `app/orders/lookup/order-lookup-client.tsx`
- `components/home/ServiceCard.tsx`
- `components/home/HomeHero.tsx`
- `components/home/TrustMiniStrip.tsx`
- `components/home/BookingGuidePanel.tsx`
- `components/quote/QuoteStepHeader.tsx`
- `components/quote/QuoteSummaryCard.tsx`
- `components/quote/QuoteStickySummary.tsx`
- `components/orders/OrderCurrentStatusPanel.tsx`
- `components/orders/NextActionCard.tsx`
- `components/orders/OrderLookupResultCard.tsx`

## 구현 내용

홈:

- 홈 hero를 `HomeHero`로 분리하고 `instagram/kakao/organic/direct` 유입별 copy와 CTA 우선순위를 정리했다.
- hero 바로 아래에 `TrustMiniStrip`을 추가해 가격 확인, 주문상태 링크, A/S 접수를 첫 화면에서 설명한다.
- 기존 service guide 영역은 `BookingGuidePanel`로 분리해 작업 선택, 사진/주소, 예약/결제 흐름을 고정 안내한다.
- `ServiceCard`는 정찰가 가능 여부를 항상 badge로 보여주도록 바꿨다.

견적:

- 기존 진행 요약 영역을 `QuoteStepHeader`로 분리했다.
- 기존 `PriceSummary` 대신 `QuoteSummaryCard`를 사용해 작업, 자재, 옵션, 사진 수, 방문 일정, 결제 전 안내를 한 번에 보여준다.
- sticky footer는 `QuoteStickySummary`로 분리하고 총액, 방문일, 사진 수, 결제 CTA를 계속 노출한다.
- `preset/source/campaign/region`, `getUtmParams`, `getSessionId`, draft/payment `sessionStorage` 흐름은 유지했다.

주문상태:

- 타임라인 위에 `OrderCurrentStatusPanel`을 추가해 현재 상태, 결제 금액, 방문 일정, 작업명을 먼저 보여준다.
- `NextActionCard`를 추가해 상태별 primary action을 첫 화면에서 노출한다.
- 기존 `StatusTimeline`, `QuoteSummary`, `ReservationCard`, feedback/A/S/reschedule/cancel 흐름은 유지했다.
- status API 기반 `status_view` 수집 구조를 유지하고 클라이언트 중복 tracking은 추가하지 않았다.

주문조회:

- 결과 카드 렌더링을 `OrderLookupResultCard`로 분리했다.
- 조회 전 설명을 줄이고 입력 2개와 조회 CTA 중심으로 유지했다.
- API response shape와 accessToken 포함 상세 링크 사용 방식은 유지했다.

## 새 컴포넌트

- `HomeHero`
- `TrustMiniStrip`
- `BookingGuidePanel`
- `QuoteStepHeader`
- `QuoteSummaryCard`
- `QuoteStickySummary`
- `OrderCurrentStatusPanel`
- `NextActionCard`
- `OrderLookupResultCard`

## 유지한 기존 구조

- 기존 라우트 구조 유지
- DB schema 변경 없음
- Toss confirm API와 payment confirm 흐름 변경 없음
- quote draft/payment draft `sessionStorage` key 유지
- `appendSourceParams`, `readClientSourceContext`, source/campaign/region 전달 유지
- 주문상태 accessToken validation 흐름 유지
- 기존 주요 퍼널 이벤트 흐름 유지

## 남은 P1/P2 TODO

- `/cases` 모바일 상세 drawer와 proof card 고도화
- `/request/photo`, `/request/photo/result` source-aware CTA와 결과 summary 개선
- admin dashboard에는 이번 Lazyweb P0를 적용하지 않음
- 실제 모바일 브라우저에서 sticky footer와 bottom CTA 충돌 여부 추가 시각 QA

## 회귀 위험 포인트

- 견적 sticky footer가 작은 화면에서 세로 높이를 많이 차지할 수 있다.
- 주문상태 화면은 기존 feedback/A/S 카드가 하단에도 남아 있어 next action과 중복으로 보일 수 있다.
- 홈 hero CTA 순서가 유입 채널별로 전환 의도에 맞게 추가 A/B 조정될 여지가 있다.
- `/quote/[serviceCode]`는 결제 로직을 건드리지 않았지만, sticky CTA copy가 바뀌었으므로 실제 Toss 결제 전후 화면 문구 QA가 필요하다.

## QA 결과

- `npm run typecheck`: 통과
- `npm run build`: 통과
- 홈 `/`: Next build에서 route 생성 확인. `HomeHero`, `TrustMiniStrip`, `BookingGuidePanel` 컴파일 확인.
- 견적 `/quote/[serviceCode]`: Next build에서 route 생성 확인. source/campaign/region 전달 코드와 draft/payment `sessionStorage` key 변경 없음.
- 주문조회 `/orders/lookup`: Next build에서 route 생성 확인. 조회 API 계약과 결과 링크 shape 변경 없음.
- 주문상태 `/orders/[id]`: Next build에서 route 생성 확인. accessToken 검증 API 흐름 변경 없음, 클라이언트 `status_view` 중복 tracking 추가 없음.
- 결제 흐름: Toss confirm API와 `handlePayment`의 request payload 변경 없음. UI summary/CTA copy만 변경.
- 제한: 이번 세션에는 callable Browser 도구가 없어 실제 모바일 스크린샷 QA는 수행하지 못했다.
