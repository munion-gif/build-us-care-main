# UX OrderStatus Implementation

작성일: 2026-05-13

## 적용 범위

이번 변경은 OrderStatus 정렬 이후 바로 반영해야 하는 고객/관리자 UX quick win에 집중했다.

## 변경 사항

| 영역 | 변경 |
| --- | --- |
| 공통 상태 UX | `lib/order-status-ux.ts` 추가. 고객/관리자용 상태 라벨, 설명, A/S 가능 조건, 금지 전이 안내를 한 곳에서 관리 |
| 고객 주문 상세 | completed 상태에서 후기/A/S처럼 보이는 CTA를 제거하고, A/S 가능 조건 카드를 추가 |
| 고객 다음 액션 | `completed`, `issue`, `warranty`, `done` 상태별 primary CTA/copy를 분리 |
| 견적/결제 | 결제 전 견적 범위 확인, 포함 금액, 결제 후 일정 확정 흐름을 명시 |
| 랜딩 예약 안내 | 문의/견적/결제/일정/최종 완료/A/S 조건 흐름을 더 명확하게 수정 |
| 관리자 주문 상세 | 허용된 다음 상태만 버튼으로 노출하는 상태 변경 패널 추가 |
| 관리자 금지 전이 | `inquiry -> payment_pending`, `completed -> warranty`, `scheduled -> done`, `canceled -> paid` 금지 이유를 UI에 표시 |

## 상태 전이 UX 반영

| 규칙 | UI 반영 |
| --- | --- |
| `inquiry -> quoted` 허용 | 관리자 상태 변경 패널에서 `견적 완료` 버튼 노출 |
| `quoted -> payment_pending` 허용 | 관리자 상태 변경 패널에서 `결제 대기` 버튼 노출 |
| `inquiry -> payment_pending` 불가 | 결제 대기 직접 전환 버튼 미노출, 금지 안내 표시 |
| `completed -> warranty` 불가 | warranty 버튼 미노출, 최종 완료 후 가능 안내 |
| `done -> warranty` 허용 | 고객 A/S CTA와 관리자 warranty 전환 노출 |
| `scheduled -> done` 불가 | done 직접 전환 버튼 미노출, 작업 진행/완료 선행 안내 |
| `canceled -> paid` 불가 | paid 전환 버튼 미노출, 새 문의 처리 안내 |

## 검증

| 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |

로컬 dev 서버를 `http://127.0.0.1:3000`에서 재시작한 뒤 실제 Chrome headless/CDP로 브라우저 시각 QA를 완료했다.

## 실제 브라우저 시각 QA

실행일: 2026-05-13

실행 명령:

- `node scripts\local-visual-qa.js`

캡처 경로:

- `screenshots/ux-order-status/landing-mobile.png`
- `screenshots/ux-order-status/quote-mobile.png`
- `screenshots/ux-order-status/customer-completed-mobile.png`
- `screenshots/ux-order-status/customer-done-mobile.png`
- `screenshots/ux-order-status/admin-completed-desktop.png`
- `screenshots/ux-order-status/admin-done-desktop.png`
- `screenshots/ux-order-status/admin-completed-mobile.png`

| 화면 | 결과 |
| --- | --- |
| 랜딩 모바일 | 주요 CTA와 견적/결제/예약/A/S 조건 안내 노출 확인. 모바일 폭에서 큰 겹침 없음 |
| 견적 상세/결제 안내 모바일 | “견적 범위를 확인한 뒤 결제” 안내와 “견적 확인하고 결제” CTA 노출 확인 |
| 고객 주문 상세 completed 모바일 | “작업 완료 확인 중”, “최종 완료 후 A/S 가능” 안내 노출. `A/S 신고하기` CTA 미노출 확인 |
| 고객 주문 상세 done 모바일 | “최종 완료”, “A/S 접수가 가능합니다” 안내와 `A/S 신고하기` CTA 노출 확인 |
| 관리자 주문 상세 completed 데스크톱/모바일 | `최종 완료` 허용, `A/S 처리` 직접 전환 차단 안내 확인 |
| 관리자 주문 상세 done 데스크톱 | `A/S 처리` 전환 CTA 노출 확인 |

콘솔 에러:

- 최종 재실행 기준 각 캡처 페이지 `consoleErrors: []`.

QA 데이터:

- 스크립트가 생성한 QA 주문은 실행 후 정리 완료.
- `staleCountAfterCleanup: 0`.

주의:

- Next dev indicator가 모바일 캡처 좌측에 떠 보이지만 dev 전용 오버레이이며 서비스 UI 요소는 아니다.

## 수동 QA 체크리스트

| 화면 | 확인 항목 |
| --- | --- |
| `/orders/:id` completed 주문 | A/S CTA 미노출, “작업 완료 확인 중 / 최종 완료 후 A/S 가능” 안내 노출 |
| `/orders/:id` done 주문 | A/S CTA 노출 |
| `/admin/orders/:id` inquiry 주문 | `견적 완료` 버튼 노출, `결제 대기` 직접 전환 미노출 |
| `/admin/orders/:id` completed 주문 | `최종 완료` 버튼 노출, `A/S 처리` 직접 전환 미노출 |
| `/admin/orders/:id` scheduled 주문 | `작업 진행` 버튼 노출, `최종 완료` 직접 전환 미노출 |
| `/admin/orders/:id` canceled 주문 | 결제 완료 전환 미노출 |
| `/quote/:serviceCode` | 결제 전 금액/범위/결제 후 일정 확정 안내 노출 |
| `/` | 예약 안내가 견적, 결제, 일정, 최종 완료/A/S 조건 흐름으로 보이는지 확인 |

## 남은 작업

- 관리자 상태 변경 패널에 사유 입력/운영 로그 이벤트를 연결하면 추적이 약한 환경에서도 상태 변경 맥락을 더 안정적으로 남길 수 있다.
- 고객 화면의 `completed` 안내는 실제 운영 기준에 맞춰 “검수 중” 또는 “고객 확인 대기” 중 하나로 더 명확히 고정할 필요가 있다.

## 레퍼런스 Quick Win 1차 적용 QA

실행일: 2026-05-13

적용 기준:

- 홈서비스 레퍼런스의 quick win 패턴 중 즉시 눈으로 확인 가능한 섹션만 반영.
- 상태 전이 규칙은 변경하지 않고, UI에서 가능한 액션과 차단 안내를 더 명확히 표현.

변경 요약:

| 화면 | 반영 내용 |
| --- | --- |
| 랜딩 | 첫 화면 하단에 `견적 → 결제 → 일정 → 작업 → 최종 완료 → A/S` 미니 타임라인과 신뢰 요약 추가 |
| 견적 상세 | `포함 항목 / 제외 항목 / 현장 추가 가능` 3분할 카드 추가, 결제 후 일정 확정 안내 및 CTA 문구 정리 |
| 고객 주문 상세 | `completed`는 최종 확인/정산 중으로 안내하고 A/S CTA 숨김, `done`은 A/S 접수 가능 배지와 CTA 노출 |
| 고객 주문 상세 공통 | 상태별 `다음에 일어나는 일` 카드 추가 |
| 관리자 상태 변경 | 허용 전이는 버튼으로, 금지 전이는 `차단 안내 카드` 텍스트로 표시 |

검증 명령:

| 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `$env:START_NEXT_SERVER='1'; node scripts\local-visual-qa.js` | 통과 |

브라우저 QA 결과:

| 화면 | 스크린샷 | 확인 결과 |
| --- | --- | --- |
| 랜딩 모바일 | `screenshots/ux-order-status/landing-mobile.png` | 미니 타임라인, 신뢰 요약, A/S 조건 노출 확인 |
| 랜딩 데스크톱 | `screenshots/ux-order-status/landing-desktop.png` | 데스크톱 레이아웃에서 타임라인/요약 노출 확인 |
| 견적 상세 모바일 | `screenshots/ux-order-status/quote-mobile.png` | 3분할 범위 카드, 결제 후 일정 확정 안내, CTA 문구 확인 |
| 고객 주문 completed | `screenshots/ux-order-status/customer-completed-mobile.png` | 최종 확인/정산 중 안내, A/S CTA 미노출, 다음 카드 확인 |
| 고객 주문 done | `screenshots/ux-order-status/customer-done-mobile.png` | A/S 접수 가능 배지, A/S CTA, 다음 카드 확인 |
| 관리자 inquiry | `screenshots/ux-order-status/admin-inquiry-desktop.png` | `견적 완료` 허용, `payment_pending` 직접 전환 차단 카드 확인 |
| 관리자 completed 데스크톱 | `screenshots/ux-order-status/admin-completed-desktop.png` | `최종 완료` 허용, `warranty` 직접 전환 차단 카드 확인 |
| 관리자 completed 모바일 | `screenshots/ux-order-status/admin-completed-mobile.png` | 모바일 폭에서 상태 변경 패널과 차단 카드 확인 |
| 관리자 done | `screenshots/ux-order-status/admin-done-desktop.png` | `A/S 처리` 허용 확인 |
| 관리자 scheduled | `screenshots/ux-order-status/admin-scheduled-desktop.png` | `done` 직접 전환 차단 카드 확인 |
| 관리자 canceled | `screenshots/ux-order-status/admin-canceled-desktop.png` | `paid` 직접 전환 차단 카드 확인 |

콘솔 에러:

- 최종 브라우저 QA 기준 모든 캡처 페이지 `consoleErrors: []`.

QA 데이터:

- 스크립트가 생성한 QA 주문은 실행 후 정리 완료.
- `staleCountAfterCleanup: 0`.

남은 TODO:

- 이번 라운드 시작 전 baseline 스크린샷은 별도 보관되어 있지 않아, 전/후 비교는 코드 변경 diff와 이번 after 캡처 기준으로만 가능하다.
- 관리자 상태 변경 패널에는 아직 사유 입력과 운영 로그 이벤트가 붙어 있지 않다.

## Quick Win UI 경량화 QA

실행일: 2026-05-13

목표:

- 상태 전이/CTA 규칙은 유지하고, Quick Win으로 추가된 안내 카드와 문구 밀도를 줄였다.
- 모바일에서 `현재 상태 + 지금 할 수 있는 것`이 먼저 보이도록 위계를 다시 잡았다.

Baseline 캡처:

- `screenshots/ux-order-status-baseline-density/landing-mobile.png`
- `screenshots/ux-order-status-baseline-density/landing-desktop.png`
- `screenshots/ux-order-status-baseline-density/quote-mobile.png`
- `screenshots/ux-order-status-baseline-density/customer-completed-mobile.png`
- `screenshots/ux-order-status-baseline-density/customer-done-mobile.png`
- `screenshots/ux-order-status-baseline-density/admin-completed-mobile.png`
- `screenshots/ux-order-status-baseline-density/admin-completed-desktop.png`

After 캡처:

- `screenshots/ux-order-status/landing-mobile.png`
- `screenshots/ux-order-status/landing-desktop.png`
- `screenshots/ux-order-status/quote-mobile.png`
- `screenshots/ux-order-status/customer-completed-mobile.png`
- `screenshots/ux-order-status/customer-done-mobile.png`
- `screenshots/ux-order-status/admin-completed-mobile.png`
- `screenshots/ux-order-status/admin-completed-desktop.png`

삭제/통합/축약:

| 화면 | 정리 내용 |
| --- | --- |
| 랜딩 | 미니 타임라인 유지, 설명 문장 제거, 신뢰 요약을 3개에서 2개로 축약 |
| 견적 상세 | 3분할 범위 카드는 유지하되 문장 길이와 패딩 축소, 결제 안내를 한 문장으로 정리 |
| 고객 주문 상세 | 별도 A/S 조건 카드를 제거하고 `다음에 일어나는 일` 카드로 흡수 |
| 고객 주문 completed | A/S 불가 안내를 조용한 한 줄 문구로 축소, CTA 미노출 유지 |
| 고객 주문 done | A/S CTA를 다음 카드 안으로 통합해 후기 카드와 경쟁을 줄임 |
| 관리자 상태 변경 | 경고 박스형 차단 카드 대신 한 줄 보조 차단 안내로 낮춤 |

정보 우선순위:

| 화면 | 1순위 | 2순위 | 3순위 |
| --- | --- | --- | --- |
| 랜딩 | 서비스 선택/상담 CTA | 진행 흐름 | 비용/A/S 신뢰 요약 |
| 견적 상세 | 가격과 결제 결정 | 포함/제외/추가 가능 범위 | 상세 입력 |
| 고객 주문 상세 | 현재 상태 | 다음에 일어나는 일/가능 CTA | 세부 주문 정보 |
| 관리자 패널 | 지금 가능한 다음 액션 | 현재 상태 설명 | 금지 전이 보조 안내 |

검증:

| 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `node scripts\local-visual-qa.js` | 통과 |

브라우저 QA:

- 최종 캡처 기준 모든 체크 true.
- `consoleErrors: []`.
- QA 주문 정리 완료: `staleCountAfterCleanup: 0`.

여전히 어색한 부분:

- 랜딩은 줄였지만, 첫 화면에서 서비스 카드 전에 안내 영역이 아직 조금 길다. 다음 라운드에서는 타임라인을 hero 바로 아래 한 줄 progress로 더 줄일 수 있다.
- 견적 모바일은 sticky 결제 CTA가 화면 중간 캡처에 걸려 보일 수 있다. 실제 사용에는 도움이 되지만 시각적으로는 하단 고정 영역 높이와 간격을 더 다듬을 여지가 있다.
- 관리자 주문 상세는 상태 패널은 가벼워졌지만 하단 운영 정보 카드들이 여전히 길다. 이번 범위 밖이라 유지했다.

## 홈/견적 예약 퍼널 분기 QA

실행일: 2026-05-13

목표:

- BuildUS Care를 `온디맨드 홈서비스 + 견적형 예약 + 작업 추적 + 재방문/A/S` 하이브리드 플랫폼 기준으로 정리했다.
- 이번 라운드는 홈 화면과 견적 상세/일정 선택 화면만 수정했다.
- OrderStatus 전이, completed/done 구분, done 이후 A/S 구조, 관리자 상태 UX는 변경하지 않았다.

반영 내용:

| 화면 | 반영 방식 |
| --- | --- |
| 홈 | 서비스를 `즉시예약형`과 `상담/견적형`으로 분리해 노출 |
| 홈 Hero | 1차 CTA는 사진 상담, 2차 CTA는 바로 예약 가능한 작업 보기로 조정 |
| 즉시예약형 견적 | 가격 확인, 일정 선택, 결제 흐름을 전면에 배치 |
| 상담/견적형 견적 | 사진, 주소, 요청사항 입력을 먼저 배치하고 일정은 견적 확정 후 조율 문구로 축소 |
| 일정 선택 | `service.standardizable === true`인 서비스에서만 적극 노출 |
| 모바일 sticky CTA | 요약 박스를 숨기고 결제 버튼만 고정해 화면 점유를 줄임 |

캡처:

- 모바일 홈: `screenshots/ux-order-status/landing-mobile.png`
- 데스크톱 홈: `screenshots/ux-order-status/landing-desktop.png`
- 즉시예약형 견적 모바일: `screenshots/ux-order-status/quote-mobile.png`
- 상담/견적형 견적 모바일: `screenshots/ux-order-status/quote-consult-mobile.png`

검증:

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `$env:START_NEXT_SERVER='1'; node scripts\local-visual-qa.js` | 통과 |
| 홈 즉시예약형/상담형 구분 | 통과 |
| 즉시예약형 일정 선택 노출 | 통과 |
| 상담형 일정 선택 비노출 | 통과 |
| 콘솔 에러 | 없음 |

남은 TODO:

- 즉시예약형 견적 화면은 기존 옵션/요약/주거 정보까지 이어져 모바일 세로 길이가 여전히 길다. 다음 라운드에서 단계 접기 또는 요약 우선 구조를 검토할 수 있다.
- 홈 화면의 빠른 흐름 보드는 유지했지만, 첫 방문자 기준으로 더 짧은 한 줄형 안내로 줄일 여지가 있다.
- 상담형 카톡 CTA는 현재 환경에서 채널 URL이 없으면 비활성 상태로 보인다. 운영 환경 설정값 확인이 필요하다.

## 예약 퍼널 2차 정리 QA

실행일: 2026-05-13

목표:

- 홈 모바일 첫 화면 아래 설명성 안내를 줄이고, 즉시예약형/상담형 서비스 진입을 더 먼저 보이게 했다.
- 즉시예약형 견적 화면에서 세부 옵션, 결제 상세, 집 정보를 접힌 보조 영역으로 낮췄다.
- 상담형 CTA는 `NEXT_PUBLIC_KAKAO_CHANNEL_URL` 값이 없을 때 막힌 버튼만 보이지 않도록 fallback 설명을 추가했다.

반영 내용:

| 화면 | 정리 내용 |
| --- | --- |
| 홈 | Hero 다음에 서비스 유형 섹션을 먼저 배치하고, 신뢰/진행 흐름 안내는 서비스 뒤로 이동 |
| 홈 모바일 | 신뢰 미니 카드 숨김, 진행 흐름은 짧은 칩형 안내로 축소 |
| 즉시예약형 견적 | 자재 등급, 결제 요약, 포함 항목, 추가 옵션을 `세부 옵션과 결제 요약` 접힘 영역으로 통합 |
| 즉시예약형 견적 | 집 정보 입력을 선택 접힘 영역으로 전환해 일정 선택 도달 시간을 줄임 |
| 상담형 견적 | 카톡 URL 미설정 시 `상담 채널 준비 중` 설명과 비활성 CTA를 함께 노출 |

운영 설정:

- 상담형 CTA 활성화에 필요한 환경값: `NEXT_PUBLIC_KAKAO_CHANNEL_URL`
- 현재 로컬 `.env.local`과 `.env.example`에는 키가 있으나 값은 비어 있다.

캡처:

- 모바일 홈: `screenshots/ux-order-status/landing-mobile.png`
- 데스크톱 홈: `screenshots/ux-order-status/landing-desktop.png`
- 즉시예약형 견적 모바일: `screenshots/ux-order-status/quote-mobile.png`
- 상담/견적형 견적 모바일: `screenshots/ux-order-status/quote-consult-mobile.png`

검증:

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `$env:START_NEXT_SERVER='1'; node scripts\local-visual-qa.js` | 통과 |
| 홈 즉시예약형/상담형 구분 | 통과 |
| 즉시예약형 일정 선택 노출 | 통과 |
| 상담형 일정 선택 비노출 | 통과 |
| 콘솔 에러 | 없음 |
| QA 데이터 정리 | `staleCountAfterCleanup: 0` |

남은 TODO:

- 즉시예약형 견적은 일정 선택까지는 빨라졌지만, 결제 전 필수 입력인 주소/고객 정보 때문에 전체 완료 흐름은 여전히 길다.
- 홈의 서비스 카드 수가 많아 즉시예약형 목록 자체는 길다. 다음 라운드에서는 대표 4개 + 전체 보기 구조를 검토할 수 있다.
- 운영 배포 전 `NEXT_PUBLIC_KAKAO_CHANNEL_URL` 값을 채워 상담형 CTA를 활성화해야 한다.
