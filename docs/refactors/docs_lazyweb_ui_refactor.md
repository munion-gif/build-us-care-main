# Lazyweb 레퍼런스 기반 UI 개선 기록

작성일: 2026-05-08

## 수집 방식

Codex 세션에서 Lazyweb 플러그인 도구가 바로 노출되지 않아, Lazyweb MCP JSON-RPC 엔드포인트를 직접 호출해 레퍼런스를 수집했다.

- 수집 결과 원본: `.lazyweb/buildus-ui-refactor-2026-05-08/lazyweb-results.json`
- 저장 스크린샷: `.lazyweb/buildus-ui-refactor-2026-05-08/references/`
- 수집 쿼리 수: 5개
- 수집 레퍼런스 수: 25개

## 수집 레퍼런스

| 쿼리 | 대표 회사 | 주목 패턴 |
|---|---|---|
| home repair service booking flow | Taskrabbit, Handybook | 서비스 카드 목록 옆에 예약 진행 방식을 짧게 설명해 사용자가 다음 행동을 이해하게 함 |
| service quote pricing page checkout | Drumroll, Yardbook | 견적/결제 화면에서 단계와 금액 요약을 결제 전 계속 확인시킴 |
| order status tracking timeline | T-Mobile, Bose | 주문 조회 화면에서 신뢰 안내와 주문 식별 정보를 먼저 보여준 뒤 상태를 추적하게 함 |
| field service management admin dashboard | Workrise, Fiix | 운영 화면은 KPI와 현장 상태를 빠르게 훑는 구조가 중요함 |
| Korean home service app onboarding | Taskrabbit, OnPhone | 로그인보다 작업 선택과 상담 진입을 먼저 노출하는 패턴이 적합함 |

## 적용 화면

### 1. `/`

레퍼런스: Taskrabbit, Handybook

현재 문제:
서비스 카드는 충분히 보이지만, 처음 들어온 사용자가 “이후 예약이 어떻게 이어지는지”를 바로 이해하기 어려웠다.

변경 내용:

- 서비스 카드 영역 아래에 `예약은 이렇게 진행돼요` 안내 섹션 추가
- 작업 선택 → 사진·주소 입력 → 예약 확인의 3단계를 카드 형태로 정리
- 모바일에서는 1열, 데스크톱에서는 3열로 반응형 처리
- Phase 2-C 추가 반영:
  - Taskrabbit 레이아웃을 참고해 서비스 목록 오른쪽에 예약 안내 패널을 추가
  - 작업 선택 → 사진·주소 확인 → 결제 후 예약 흐름을 데스크톱에서 계속 보이게 구성
  - 후기 신뢰 문구를 패널 하단에 배치

### 2. `/quote/[serviceCode]`

레퍼런스: Drumroll checkout, Handybook quote form

현재 문제:
가격 상세와 입력 폼은 있지만, 사용자가 결제 전까지 남은 단계를 한눈에 보기 어려웠다.

변경 내용:

- 서비스 헤더 바로 아래에 현재 예상 금액 요약 추가
- 사진 → 주소 → 예약 → 결제 4단계 진행 안내 추가
- 기존 디자인 토큰을 유지하면서 흰 카드, 베이지 배경, 프라이머리 그린 강조를 적용
- Phase 2-C 추가 반영:
  - Drumroll checkout의 Order Summary 패턴을 참고해 결제 하단 고정 영역에 주문 요약 카드 추가
  - 가격 카드에 Order Summary 라벨을 추가해 결제 전 판단 지점을 명확히 함
  - 입력 중인 섹션이 더 잘 보이도록 focus-within 강조 처리

### 3. `/orders/[id]`

레퍼런스: T-Mobile order status, Bose track order

현재 문제:
상태 타임라인은 동작하지만, 외부 링크로 들어온 고객에게 “이 링크가 안전한지, 개인정보가 보호되는지”를 먼저 설명하는 장치가 부족했다.

변경 내용:

- 주문 헤더 아래 신뢰 안내 스트립 추가
- 안전한 주문 링크, 개인정보 보호, 1년 A/S를 3개 카드로 표시
- 모바일에서는 세로 스택으로 전환
- Phase 2-C 추가 반영:
  - Microsoft order tracking의 큰 상태 요약 블록을 참고해 현재 진행 상태 패널 추가
  - 서비스, 결제 금액, 방문 일정을 타임라인 전에 먼저 요약
  - 고객이 링크 진입 직후 현재 상태를 바로 이해하도록 정보 계층 조정

## 적용 파일

- `app/home-client.tsx`
- `app/quote/[serviceCode]/quote-detail-client.tsx`
- `app/orders/[id]/order-status-client.tsx`

## 검증 결과

- `npm run typecheck`: 통과
- `npm run build`: 통과
- Vercel 프로덕션 재배포: 완료
- Production URL: `https://buildus-care-flow.vercel.app`
- Deployment URL: `https://buildus-care-flow-mzn9xy3tb-juns-projects-58815d6e.vercel.app`
- 응답 확인:
  - `/`: 200 OK
  - `/quote/toilet_replace`: 200 OK
  - `/admin/login`: 200 OK
- 운영 DB 최신 주문 3건 조회: 성공
