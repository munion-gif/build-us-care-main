# INSTAGRAM_TRAFFIC_UX_REPORT

## 구현 요약

이번 작업은 새 스키마나 마이그레이션 없이, 인스타 광고에서 처음 유입된 고객이 더 빠르게 이해하고 안심하고 행동할 수 있도록 랜딩, 견적, 주문조회, 주문상태, 사례 CTA 흐름을 정리한 1차 UX 개선입니다.

참고 기준 시나리오는 작업 디렉토리의 [gg.html](C:/Users/user/Documents/New%20project/gg.html) `고객 시뮬레이션 + P&L (플랫폼·기사)` 문서이며, 특히 `수원 변기 교체 정찰가` 인스타 광고 유입 시나리오의 흐름을 따라 다음 구간을 다듬었습니다.

- 인스타 유입 판별 및 상태 유지
- 랜딩 첫 화면 카피/CTA 분기
- 견적 플로우의 부담 완화
- 주문 상태/결제 후 안내 문구 강화
- 사례 CTA와 주문조회의 source-aware 처리
- 경량 이벤트 메타 보강

## 무엇을 왜 바꿨는지

### 1. 인스타 유입 판별 공용화

추가 파일:

- [lib/traffic-source.ts](C:/Users/user/Documents/New%20project/lib/traffic-source.ts:1)

구현 내용:

- `utm_source`, `utm_medium`, `utm_campaign`, `ref`, `region`을 읽어 `trafficSource`를 정규화
- `instagram | direct | organic | kakao | phone | web | unknown` 형태로 공용 처리
- 최초 유입 컨텍스트를 `sessionStorage`에 보존
- 랜딩, 사례, 주문조회, 견적 진입 링크에 source query를 유지

이유:

- 인스타 광고 유입 고객은 1회성 모바일 방문일 가능성이 높아서, 첫 진입의 맥락을 이후 화면까지 유지하는 게 중요했습니다.

### 2. 랜딩 첫 화면을 인스타/일반 유입으로 분기

수정 파일:

- [app/home-client.tsx](C:/Users/user/Documents/New%20project/app/home-client.tsx:1)
- [components/home/BottomCTA.tsx](C:/Users/user/Documents/New%20project/components/home/BottomCTA.tsx:1)

인스타 유입 시:

- 히어로 카피를 문제 해결형 문장으로 변경
- 인스타 전용 배지 노출
- 첫 화면에 신뢰 포인트를 짧은 배지로 정리
- 히어로 메인 CTA를 `사진으로 우리 집 견적 받기` 1개로 집중
- 서비스/사례/사진 진입 링크에 source query 유지

일반 유입 시:

- 기존 탐색형 구조 유지
- 검색 입력, 서비스 선택, 사진 판정 CTA 유지

이유:

- 광고 유입 고객은 "무슨 서비스인지 즉시 이해"와 "바로 행동"이 더 중요했고, 일반 유입은 탐색 여지가 필요했습니다.

### 3. 견적 플로우를 3단계 인지 구조로 정리

수정 파일:

- [app/quote/[serviceCode]/quote-detail-client.tsx](C:/Users/user/Documents/New%20project/app/quote/%5BserviceCode%5D/quote-detail-client.tsx:1)
- [lib/quote-preset.ts](C:/Users/user/Documents/New%20project/lib/quote-preset.ts:1)

구현 내용:

- `utm_source=instagram`, `ref=instagram`도 서버 preset 단계에서 인식
- 상단 진행 영역을 `1/3 기본 정보`, `2/3 집 정보`, `3/3 일정/요청` 구조로 변경
- `* 표시된 필수 항목만 입력해도 기본 상담이 가능합니다.` 안내 추가
- 인스타 유입 시 `사진과 기본 정보만 남겨주셔도 됩니다` 문구 추가
- 필드 레이블을 `*`, `(선택)` 규칙으로 정리
- 결제 영역의 액션을 사실상 1개의 핵심 CTA로 정리
- 결제 후 주문 상태 페이지에서 확인할 수 있다는 문구 추가

이유:

- 기존 폼은 기능은 충분했지만, 처음 보는 고객 기준으로는 "어디까지 꼭 써야 하는지"와 "지금 몇 단계인지"가 즉시 읽히지 않았습니다.

### 4. 주문 상태와 결제 후 안내 문구 보강

수정 파일:

- [app/orders/[id]/order-status-client.tsx](C:/Users/user/Documents/New%20project/app/orders/%5Bid%5D/order-status-client.tsx:1)
- [lib/order-status-label.ts](C:/Users/user/Documents/New%20project/lib/order-status-label.ts:1)

구현 내용:

- 결제 완료 카드에 이후 진행 안내 bullet 추가
- 상태 요약 패널에 현재 상태별 다음 안내 문구 추가
- `paid / scheduled / reservation_confirmed / warranty / issue / inquiry` 계열 문구를 고객 중심 한국어로 다듬음
- 알림 연동이 아직 확정되지 않은 부분은 `안내드릴 예정입니다` 수준으로만 표현

이유:

- 결제 후 가장 큰 불안은 "이제 무슨 일이 일어나는가"이므로, 상태 자체보다 다음 진행을 이해시키는 문장이 필요했습니다.

### 5. 사례/주문조회도 source-aware로 연결

수정 파일:

- [app/cases/cases-client.tsx](C:/Users/user/Documents/New%20project/app/cases/cases-client.tsx:1)
- [app/orders/lookup/order-lookup-client.tsx](C:/Users/user/Documents/New%20project/app/orders/lookup/order-lookup-client.tsx:1)

구현 내용:

- 사례 페이지 히어로를 인스타 유입 시 전환형 카피로 분기
- 사례 CTA 클릭 시 quote/photo 링크에 source query 유지
- 주문조회 페이지에 인스타 유입 안내 문구 추가

이유:

- 광고 유입 고객이 사례를 보다가 견적/사진으로 넘어가거나, 결제 후 주문을 다시 찾는 흐름이 끊기지 않도록 연결성을 높였습니다.

### 6. 이벤트/메타 보강

수정 파일:

- [lib/tracking.ts](C:/Users/user/Documents/New%20project/lib/tracking.ts:1)
- [lib/event-types.ts](C:/Users/user/Documents/New%20project/lib/event-types.ts:1)

구현 내용:

- `instagram_landing_view`
- `cases_cta_click`
- `order_lookup_from_instagram`

그리고 기존 이벤트에도 공통으로 아래 메타가 붙도록 정리:

- `utm_source`
- `utm_campaign`
- `utm_medium`
- `traffic_source`
- `landing_path`
- `ref`

## 인스타 유입 vs 일반 유입 UX 차이

### 인스타 유입

- 더 직접적인 문제 해결형 히어로 카피
- 사진 기반 CTA 우선
- 짧은 신뢰 포인트를 첫 화면에 노출
- 사례/견적/사진 링크에 source context 유지
- 견적 화면에서 부담 완화 문구 노출

### 일반 유입

- 기존 탐색형 홈 구조 유지
- 검색과 서비스 선택 유지
- 서비스 탐색과 사례 탐색을 함께 고려한 진입 구조 유지

## URL / 쿼리 파라미터 규칙

지원 규칙:

- `/?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price`
- `/cases?utm_source=instagram&utm_medium=social&utm_campaign=...`
- `/quote/[serviceCode]?utm_source=instagram...`
- `ref=instagram` 보조 인식 지원

동작 방식:

1. 최초 로드 시 query를 읽어 `trafficSource` 정규화
2. `sessionStorage`에 source context 저장
3. 이후 quote/photo/cases 링크에 source query를 유지
4. 기존 tracking 이벤트에도 source 메타를 함께 전송

## 테스트 경로 / 케이스

### 빌드/타입

- `npm run typecheck` 통과
- `npm run build` 통과

### 프로덕션 배포

- Production URL: [https://buildus-care-flow.vercel.app](https://buildus-care-flow.vercel.app)
- Deployment ID: `dpl_DHoZ7a1UbXAUpjgkcxLmYVLS9ooR`
- 배포 일시 기준: 2026-05-12 KST

### 공개 경로 응답 확인

실 응답 200 확인:

- [https://buildus-care-flow.vercel.app/](https://buildus-care-flow.vercel.app/)
- [https://buildus-care-flow.vercel.app/?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price](https://buildus-care-flow.vercel.app/?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price)
- [https://buildus-care-flow.vercel.app/cases?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price](https://buildus-care-flow.vercel.app/cases?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price)
- [https://buildus-care-flow.vercel.app/orders/lookup?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price](https://buildus-care-flow.vercel.app/orders/lookup?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price)

### 기능 검증 메모

- 인스타 분기 문구는 클라이언트 hydration 후 적용되는 구조
- 프로덕션 HTML 응답과 build 결과, 실제 분기 코드 경로는 확인
- 다만 이 환경에서는 브라우저 자동화용 Playwright 브라우저 바이너리가 없어, 렌더 후 텍스트를 자동 스냅샷으로 최종 검증하지는 못함
- 토큰이 필요한 `/orders/[id]?accessToken=...` 상세는 공개 URL만으로 실주문 검증하지 않고 코드/빌드 기준 검증으로 남김

## 회귀 확인 범위

- `/` 홈 랜딩 빌드/배포 정상
- `/cases` 빌드/배포 정상
- `/orders/lookup` 빌드/배포 정상
- `/quote/[serviceCode]` 빌드/배포 정상
- 기존 `/api/events`, `/api/orders/lookup` 라우트 타입/빌드 정상

## 남은 한계

1. 인스타 유입 전용 성과 비교용 관리자 리포트는 아직 없음  
현재는 이벤트 meta가 쌓이도록만 정리했고, 별도 운영 대시보드 집계는 다음 단계입니다.

2. 주문상태 상세의 프로덕션 실주문 QA는 토큰 제약이 있음  
테스트용 안전 링크 세트를 운영 문서로 따로 관리하면 다음 턴 검증이 쉬워집니다.

3. 사진 판정 페이지 자체의 인스타 전용 카피 분기는 아직 최소 수준  
이번 턴은 랜딩과 견적 흐름을 우선했고, `/request/photo` 전용 카피 최적화는 후속 여지가 있습니다.

## 다음 추천 작업 3개

1. `instagram` source 기반 전환 퍼널 집계 추가  
`landing_view -> quote_started -> quote_submitted -> payment_completed -> status_page_view`

2. `/request/photo` 화면도 source-aware로 분기  
인스타 유입 고객용 짧은 안내, 필수/선택 표기, 결과 후 CTA 보강

3. 테스트용 주문 상태 링크 QA 세트 문서화  
마스킹된 테스트 주문번호와 accessToken 기반 링크를 운영 문서로 보관해서 배포 후 검증 속도를 높이기
