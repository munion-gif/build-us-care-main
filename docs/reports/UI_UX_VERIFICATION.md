# UI/UX 검증 보고서

검증일: 2026-05-11  
검증 환경: 프로덕션 (https://buildus-care-flow.vercel.app)  
검증 방식: 프로덕션 HTTP 응답 확인, 관리자 로그인 세션 확인, 운영 DB 조회, 코드 기반 반응형/상태 검증. 브라우저 플러그인 실행은 앱 서버 경로 오류로 중단되어 픽셀 단위 스크린샷 검증은 제외했습니다.

## 고객 흐름

- [x] 홈 페이지 데스크탑: 히어로, 서비스 카드, 사진 판정소, 신뢰 배지, 카카오 CTA 구조 확인
- [x] 홈 페이지 모바일 375px: 서비스 카드 2열, 모바일 CTA, safe area CSS 적용 확인
- [x] 홈 히어로 CTA: 문제 발견 후 `서비스 고르기`, `사진 판정받기` CTA 추가
- [x] 서비스 카드 9종: 아이콘, 서비스명, 설명, 가격/상담 필요 표시 확인
- [x] 사진 판정소: 교체추천/보류/교체불필요/현장확인필요 기준 문구 확인
- [x] "멀쩡한 건 바꾸지 않습니다" 메시지 노출 확인
- [x] 신뢰 배지: placeholder가 아닌 실제 운영 문구 확인
- [x] 푸터: 회사명, 사업자 정보, 대표 전화 항목 확인. 대표 전화 값은 아직 준비 중
- [x] 견적 페이지 스텝 인디케이터: 정보 입력 → 날짜 선택 → 견적 확인 → 결제 구조 확인
- [x] 견적 정보 입력: 이름, 전화번호, 주소, 층수, 가구 인원, 아이·노약자 여부 입력 확인
- [x] 주소 입력 완료 표시 및 필수값 인라인 오류 처리 확인
- [x] 예약 캘린더: 슬롯 API 로딩/오류/마감/사용량 구조 확인
- [x] 모바일 슬롯 카드: 문제 발견 후 오전/오후 2열 유지로 수정
- [x] 결제 CTA: 하단 sticky 및 safe area padding 적용 확인
- [x] 이전 시공 이력 카드: 전화번호 기준 이력 조회 확인
- [x] 이전 주문 링크: accessToken 없는 링크가 오류를 만들 수 있어 상세 링크 대신 안내 문구로 수정
- [x] 사진 판정 페이지: 서비스 선택, 사진 3장 가이드, 썸네일, 분석 로딩, 결과 카드/CTA 구조 확인
- [x] 주문 상태 페이지: 최근 운영 주문 URL 200 OK 확인
- [x] 주문 상태 타임라인: 한글 상태, 현재 상태 강조, 예약/결제 카드 구조 확인
- [x] 후기 완료 후 재방문 유도: 관련 서비스 추천 카드 노출 확인

## 공통 컴포넌트

- [x] 헤더: 현재 경로 활성화, 모바일 로고+상담 버튼 축약, PWA safe area top 적용 확인
- [x] 하단 고정 요소: 홈 CTA, 견적 CTA, 기사 앱 탭바 safe area bottom 적용 확인
- [x] 버튼 기본/disabled/hover 스타일 확인
- [x] 폼 focus/error/success 스타일 확인
- [x] 토스트/알림: 별도 전역 토스트 컴포넌트는 없음. 현재는 인라인 메시지 방식으로 한글 안내 처리

## 관리자 UI

- [x] 관리자 로그인 세션으로 `/admin/slots` 200 OK 확인
- [x] 관리자 로그인 세션으로 `/admin/diagnoses` 200 OK 확인
- [x] 관리자 로그인 세션으로 `/admin/analytics` 200 OK 확인
- [x] 관리자 로그인 세션으로 `/admin/technicians` 200 OK 확인
- [x] 관리자 로그인 세션으로 `/admin/settings` 200 OK 확인
- [x] 슬롯 관리: 오전/오후 사용량, 차단/해제, cap 설정 코드 확인
- [x] 사진 판정 목록: 배지, 신뢰도, 근거, 썸네일, 필터, 페이지네이션 구조 확인
- [x] 사진 판정 목록 모바일: 문제 발견 후 2열 고정 레이아웃을 반응형 1열로 수정
- [x] 분석: 핵심 지표, 판정 분포, 퍼널 전환율, A/S 만료 임박 섹션 확인
- [x] 기사 관리: 현재 활성 기사 2명 운영 DB 확인
- [x] 기사 등록: 담당 지역 입력 누락 발견 후 추가
- [x] 기사 활성화/비활성화: 토글 기능 누락 발견 후 추가
- [x] 설정: 카카오 채널 URL, 대표 전화, slot cap, 알림 방식, 관리자 이메일/전화번호 저장 구조 확인
- [x] 관리자 사이드바: 대시보드/주문/슬롯/사진판정/기사/분석/설정 메뉴 확인

## 기사 앱

- [x] `/technician/login` 200 OK 확인
- [x] 로그인 화면: 모바일 전용 카드/버튼 구조 확인
- [x] 오늘 작업 목록: API/화면 구조 확인
- [x] 시공 시작/사진 업로드/완료 보고: API와 화면 라우트 존재 확인
- [x] 하단 탭바 safe area bottom 적용 확인

## 발견된 문제 및 수정 내역

| 구분 | 문제 내용 | 수정 여부 | 수정 내용 |
|---|---|---:|---|
| 홈 | 히어로에 즉시 행동 CTA가 부족함 | ✅ | `서비스 고르기`, `사진 판정받기` CTA 추가 |
| 홈/푸터 | 대표 전화 항목이 푸터에 없음 | ✅ | `대표 전화: 준비 중` 항목 추가 |
| 견적 페이지 | 모바일에서 오전/오후 슬롯 카드가 1열로 떨어짐 | ✅ | 720px 이하에서도 슬롯 카드는 2열 유지 |
| 견적 페이지 | 이전 주문 보기 링크가 accessToken 없이 열려 오류 가능 | ✅ | 직접 링크 제거, 전용 링크 안내 문구로 변경 |
| 관리자 사진 판정 | 목록+패널 2열 고정으로 모바일 깨짐 가능 | ✅ | `adm-diagnoses-layout` 반응형 1열 처리 |
| 기사 관리 | 담당 지역 입력 필드 없음 | ✅ | `technicians.region`, `note` 컬럼 및 등록 폼 추가 |
| 기사 관리 | 활성/비활성 토글 없음 | ✅ | 관리자 PATCH API와 토글 버튼 추가 |

## 수정하지 않은 항목 및 이유

- 카카오 채널 URL은 아직 `https://pf.kakao.com/_placeholder` 상태입니다. 실제 채널 URL은 운영자가 `/admin/settings`에서 입력해야 합니다.
- 전역 토스트 시스템은 아직 없습니다. 현재는 각 화면의 인라인 메시지로 고객에게 한글 안내를 표시합니다.
- PWA/WebView 실제 기기 safe area는 코드와 CSS 기준으로 확인했습니다. 실제 iOS/Android 기기 스크린샷 검증은 별도 실기기 QA가 필요합니다.

## 프로덕션 응답 확인

- `/` 200 OK
- `/quote/toilet_replace` 200 OK
- `/request/photo` 200 OK
- `/technician/login` 200 OK
- `/orders/ae7b68de-56b6-4713-9e6d-a7aa53319e66?accessToken=...` 200 OK
- `/admin/slots` 200 OK
- `/admin/diagnoses` 200 OK
- `/admin/analytics` 200 OK
- `/admin/technicians` 200 OK
- `/admin/settings` 200 OK

## 최종 빌드

- typecheck: PASS
- build: PASS
- Vercel production deploy: PASS

## 주문 상태 문구/데이터 일치성 점검 (2026-05-11)

- [x] 상태 설계표를 `docs/order-status-mapping.md`에 문서화
- [x] `orders.status = paid`, 대표 `jobs.status = null`이면 고객 화면 문구를 "결제 완료, 기사 배정 중"으로 표시
- [x] `orders.status = paid|scheduled`, 대표 `jobs.status = scheduled`이면 고객 화면 문구를 "방문 예약 확정"으로 표시
- [x] `orders.status = in_progress`, 대표 `jobs.status = in_progress`이면 "시공 중"으로 표시
- [x] `orders.status = completed`, 대표 `jobs.status = done`이면 "시공 완료, 검수 중"으로 표시
- [x] `orders.status = done`, 대표 `jobs.status = done|inspected`이면 "시공 완료"로 표시
- [x] 고객 화면 담당 기사명은 `jobs.technicians.name` 기준으로, 관리자 주문 상세/슬롯 화면과 같은 원천 데이터를 사용
- [x] 오전/오후 표기는 `morning`/`afternoon` 기준으로 고객 예약 카드와 관리자 슬롯 화면이 같은 의미를 사용
