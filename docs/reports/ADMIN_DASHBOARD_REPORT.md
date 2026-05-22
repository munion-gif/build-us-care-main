# 관리자 운영 대시보드 구현 보고서

작성일: 2026-05-12  
검증 환경: 로컬 빌드 + Vercel Production + 프로덕션 Supabase DB

## 1. 작업 목적

관리자가 매일 아침 오늘 처리할 운영 업무를 한 화면에서 확인할 수 있도록 `/admin/dashboard` 운영 대시보드를 추가했습니다.

이번 작업은 새 스키마나 마이그레이션 없이 기존 데이터를 재활용하는 범위로 진행했습니다.

- `orders`
- `payments`
- `reservations`
- `jobs`
- `warranty_cases`
- `events`
- `diagnoses`

## 2. 구현 결과

| 항목 | 결과 |
|---|---|
| 신규 경로 | `/admin/dashboard` 추가 |
| 기존 `/admin` 처리 | 기존 KPI/최근 주문 내용을 대시보드에 이관 후 `/admin/dashboard`로 redirect |
| 관리자 메뉴 | `운영 대시보드` 메뉴 추가 |
| 서버 컴포넌트 조회 | 별도 API route 없이 `app/admin/dashboard/page.tsx`에서 Supabase 직접 조회 |
| 새 DB 스키마 | 없음 |
| 새 migration | 없음 |

## 3. 화면 구성

### 상단 요약 카드

4개 핵심 지표를 표시합니다.

- 오늘 주문 수
- 오늘 결제 완료 수
- 오늘 방문 예정 건수
- 오늘 신규 A/S 접수 수

기존 `/admin`의 보조 KPI도 각 카드 하단과 하단 목록에 보존했습니다.

- 이번 주 매출
- 판정 대기
- 평균 NPS
- 견적 미수락
- 이슈 건수
- 이번 주 시공 완료
- 최근 주문 5건

### 미배정/주의 주문

다음 두 영역을 추가했습니다.

- 미배정 `paid` 주문
- 내일 방문 예정인데 기사 미배정인 주문

내일 방문 예정 미배정 판단은 요청대로 `jobs`가 아니라 `reservations.reserved_date = tomorrow` 기준으로 구현했습니다.

### 오늘/내일 방문 일정

오늘 방문과 내일 방문을 나란히 표시합니다.

- 기사 이름
- 주문번호
- 오전/오후
- 주소 요약
- 상태

각 항목은 안전하게 `/admin/orders/[orderId]`로 이동합니다.

### 하단 운영 알림

아래 3개 섹션을 추가했습니다.

- 오늘 접수된 A/S
- 최근 24시간 사진 판정 요약
- 오늘 예약 변경 수

A/S 상세 페이지는 현재 없으므로 `/admin/orders/[orderId]`로 연결했습니다.

## 4. 주요 구현 파일

| 파일 | 내용 |
|---|---|
| `app/admin/dashboard/page.tsx` | 운영 대시보드 서버 컴포넌트 및 데이터 조회 함수 |
| `app/admin/page.tsx` | `/admin` → `/admin/dashboard` redirect |
| `app/admin/admin-shell.tsx` | 관리자 메뉴의 대시보드 링크 변경 |
| `app/admin/admin.css` | 대시보드 그리드, 액션 리스트, 모바일 반응형 스타일 추가 |

## 5. 데이터 기준

| 데이터 | 기준 |
|---|---|
| 오늘 | KST 00:00:00 ~ 다음날 00:00:00 |
| 내일 | KST 기준 오늘 + 1일 |
| 최근 24시간 | 현재 시각 기준 24시간 전 이후 |
| 오늘 주문 수 | `orders.created_at` |
| 오늘 결제 완료 수 | `payments.status = done`, `payments.paid_at` |
| 오늘 방문 예정 건수 | `jobs.status = scheduled`, `jobs.scheduled_at` |
| 오늘 신규 A/S 접수 수 | `warranty_cases.created_at` |
| 미배정 paid 주문 | `orders.status = paid`이고 active assigned job 없음 |
| 내일 예약 미배정 | `reservations.reserved_date = tomorrow`, 주문 상태 `paid/scheduled`, active assigned job 없음 |
| 예약 변경 수 | `events.event_type = reservation_rescheduled`, `events.created_at` |

## 6. 검증 결과

### 로컬 검증

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |

참고: 로컬 `npm run build` 출력 마지막에 sandbox 네트워크 제한으로 보이는 `fetch failed EACCES` 로그가 있었으나, 빌드 프로세스는 exit 0으로 성공했고 `/admin/dashboard` 라우트도 정상 포함됐습니다.

### 프로덕션 배포

| 항목 | 값 |
|---|---|
| Production URL | https://buildus-care-flow.vercel.app |
| Deployment URL | https://buildus-care-flow-4i6rzxzql-juns-projects-58815d6e.vercel.app |
| Deployment ID | `dpl_Fj9VLteV33n6c63Shqf9CkAHWiwc` |
| 상태 | READY |

### 접근 권한 확인

| 확인 항목 | 결과 |
|---|---|
| 비로그인 `/admin/dashboard` | 307 `/admin/login` redirect |
| 관리자 쿠키 포함 `/admin/dashboard` | 200 OK |
| 관리자 쿠키 포함 `/admin` | 307 `/admin/dashboard` redirect |

## 7. 프로덕션 숫자 sanity check

프로덕션 Supabase DB 기준으로 대시보드 핵심 숫자를 확인했습니다.

| 항목 | 값 |
|---|---:|
| 오늘 주문 수 | 1 |
| 오늘 결제 완료 수 | 1 |
| 오늘 방문 예정 건수 | 1 |
| 오늘 신규 A/S 접수 수 | 0 |
| 미배정 paid 주문 | 14 |
| 내일 방문 예정 기사 미배정 | 0 |
| 오늘 active jobs | 1 |
| 내일 active jobs | 0 |
| 최근 24시간 사진 판정 | 0 |
| 오늘 예약 변경 수 | 2 |

오늘 예약 변경 슬롯 요약:

| 변경 | 건수 |
|---|---:|
| `afternoon -> afternoon` | 1 |
| `morning -> afternoon` | 1 |

최근 24시간 사진 판정은 0건이라 result/service breakdown은 비어 있었습니다.

## 8. 완료 기준 체크

| 기준 | 결과 |
|---|---|
| `/admin/dashboard` 페이지 추가 | 완료 |
| 기존 `/admin` 내용 보존 후 이관 | 완료 |
| `/admin` redirect 처리 | 완료 |
| 상단 요약 카드 4개 표시 | 완료 |
| 미배정 paid 주문 표시 | 완료 |
| 내일 방문 예정 기사 미배정 표시 | 완료 |
| 오늘/내일 방문 일정 표시 | 완료 |
| 오늘 A/S 표시 | 완료 |
| 최근 사진 판정 표시 | 완료 |
| 오늘 예약 변경 수 표시 | 완료 |
| 없는 상세 경로 대신 주문 상세 링크 사용 | 완료 |
| `npm run typecheck` 통과 | 완료 |
| `npm run build` 통과 | 완료 |
| 프로덕션 배포 후 숫자 sanity check | 완료 |

## 9. 후속 작업 제안

다음 작업은 실알림 연결이 자연스럽습니다.

우선순위 이벤트:

- 결제 완료
- 방문 예약 확정
- 예약 변경
- A/S 접수

알림 채널 후보:

- 카카오 알림톡
- SMS
- 이메일
