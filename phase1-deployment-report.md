# Buildus Care Phase 1 배포 보고서

작성일: 2026-05-07

## 1. 배포 결과

Phase 1 관리자/고객 플로우 최신 버전을 Vercel Production에 배포했습니다.

- Production URL: https://buildus-care-flow.vercel.app
- Deployment URL: https://buildus-care-flow-33r0yf1iq-juns-projects-58815d6e.vercel.app
- Vercel Project: buildus-care-flow
- Deployment ID: dpl_C3GaGeM1XV7e1X7hZ4Qi2LiLor6a
- 상태: READY

## 2. 배포 전 로컬 검증

아래 검증을 통과한 뒤 배포했습니다.

- `npm run typecheck` 통과
- `npm run build` 통과
- 관리자 페이지 stale chunk 오류 방지를 위해 `.next` 캐시 제거 후 dev 서버 재시작
- 로컬 `/admin/login` 200 확인
- 로컬 쿠키 없는 `/admin` 접근 시 `/admin/login` redirect 확인

## 3. Vercel 배포 검증

배포 후 프로덕션 URL에서 주요 경로를 확인했습니다.

| 경로 | 결과 |
| --- | --- |
| `/` | 200 OK |
| `/services` | 200 OK |
| `/quote/toilet_replace` | 200 OK |
| `/admin/login` | 200 OK |
| `/admin` 쿠키 없이 접근 | 307 `/admin/login` redirect |

## 4. 이번 배포에 포함된 주요 변경

### 관리자 CSS 시스템 정비

- `app/admin/admin.css` 추가
- 관리자 페이지 인라인 스타일 제거
- 공통 클래스 체계 적용:
  - `adm-shell`
  - `adm-card`
  - `adm-table`
  - `adm-badge`
  - `adm-btn`
  - `adm-modal`
  - `adm-photo-grid`

### 관리자 대시보드 강화

대시보드 KPI를 4개에서 8개로 확장했습니다.

- 오늘 신규 주문
- 오늘 결제 완료
- 이번 주 매출
- 판정 대기
- 평균 NPS
- 견적 미수락
- 이슈 건수
- 이번 주 시공 완료

### 주문 관리 강화

- 주문 목록 필터 추가:
  - 상태
  - 서비스
  - 채널
  - 긴급도
  - 유입 출처
  - 날짜
  - 검색
- 주문 상세에서 P0 수집 데이터 표시:
  - 고객 유입 출처
  - 주거 유형
  - 건물 유형
  - 준공연도
  - 평수
  - 주문 채널
  - 의뢰 사유
  - 긴급도
  - SKU
  - 후기/NPS/5축 점수

### 현장 관리 강화

- 시공 시작 시 예상 시공 시간 저장
- 시공 완료 시 아래 데이터 저장:
  - 실제 시공 시간
  - 사용 자재
  - 추가 자재
  - 완료 메모
  - 현장 이슈
- 검수 시 체크리스트 저장:
  - 시공 전후 사진 확인
  - 자재 사용 확인
  - 누수/오작동 확인
  - 예상 시간 오차 확인
  - 현장 청결 확인
- 현장 상세에서 before/during/after/material/issue 사진 업로드 액션 제공

### 기사 관리 강화

- 기사 등록 필드 보강:
  - 이름
  - 전화번호
  - 유형
  - 등급
  - 담당 서비스 복수 선택
- 기사 목록 표시 보강:
  - 평균 NPS
  - 검수 통과율
  - 이번 달 건수
  - 활성 상태

### 사진 판정 관리 강화

- 판정 사진 목록 표시
- 판정 결과 배지 색상 적용
- 판정 결과 저장 필드 보강:
  - 결과
  - 고객 안내 메시지
  - 내부 사유
  - 추천 서비스 코드

## 5. Vercel 환경변수 상태

현재 Vercel에 확인된 환경변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `ADMIN_API_KEY`
- `PAYMENT_MOCK_MODE`

추가 입력이 필요한 환경변수:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- `TOSS_SECRET_KEY`
- `NEXT_PUBLIC_KAKAO_CHANNEL_URL`
- `NEXT_PUBLIC_STORAGE_URL`
- `DATABASE_URL`

주의:
관리자 로그인 기능은 `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`이 Vercel에 입력되어야 정상 동작합니다. 보안 정책상 로컬 `.env.local`의 비밀값을 자동 업로드하지 않았습니다. Vercel 대시보드에서 직접 입력해야 합니다.

## 6. 현재 상태 요약

고객용 핵심 경로와 관리자 로그인 화면은 프로덕션에서 정상 응답합니다.

다만 관리자 실제 로그인, 결제 실연동, 카톡 상담 CTA, DB direct migration 관련 기능은 Vercel 환경변수 보강 후 최종 확인이 필요합니다.

## 7. 다음 액션

1. Vercel 대시보드에 누락 환경변수 직접 입력
2. 관리자 로그인 확인
3. 관리자 대시보드 KPI 데이터 확인
4. 주문 생성 → 견적 → 결제 → 상태 조회 프로덕션 플로우 테스트
5. 필요 시 프로덕션 DB 마이그레이션 runbook 실행
