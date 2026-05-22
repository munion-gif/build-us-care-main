# Build us Care 홈페이지 작업 분석 기록

작성일: 2026-05-21

작업 기준 폴더:

`/Users/hellomymac/Desktop/02. muni/07. Build us Care/03. build-us-care-main`

## 1. 현재 상태 요약

이 폴더는 Next.js 기반의 Build us Care 웹사이트/예약 MVP 프로젝트다.

현재 로컬 작업 준비는 끝난 상태다.

- 의존성 설치 완료: `npm ci`
- 타입 검사 완료: `npm run typecheck`
- 실제 빌드 검증 완료: `npm run build`
- 로컬 개발 서버 실행 중: `http://localhost:3001`
- Safari에서 로컬 사이트 열어둔 상태
- 로컬 환경 파일 생성: `.env.local`
- 로컬 개발 환경에서 Supabase가 없을 때 추적 API가 500을 내지 않도록 최소 처리 완료

주의할 점:

- 이 폴더는 현재 Git 저장소가 아니다. 즉, `git status`, `git diff`, `git checkout` 같은 방식으로 변경 전 상태를 추적할 수 없다.
- 앞으로 중요한 변경을 하기 전에는 백업 파일 또는 작업 기록을 남기면서 진행하는 것이 안전하다.
- `3000` 포트에는 다른 서버가 떠 있거나 깨진 서버가 응답하고 있어, 이 폴더의 미리보기는 `3001` 포트를 기준으로 봐야 한다.

## 2. 설치 및 실행 상태

### 설치된 의존성

`npm ci`로 `package-lock.json` 기준 설치가 완료되었다.

설치 후 npm 보안 경고가 있었다.

- moderate 3개
- high 1개

자동 수정은 하지 않았다. `npm audit fix`는 의존성 버전이나 동작을 바꿀 수 있으므로, 별도 판단 후 진행하는 것이 맞다.

### 확인한 명령

```bash
npm run typecheck
npm run build
npm run dev -- -p 3001
```

결과:

- TypeScript 오류 없음
- Next.js 빌드 성공
- 개발 서버 정상 실행

## 3. 로컬 환경 설정

현재 `.env.local`은 개발 확인용 최소 설정이다.

```env
NEXT_PUBLIC_KAKAO_CHANNEL_URL=https://pf.kakao.com/_PxkzsX?from=qr
NEXT_PUBLIC_SITE_URL=http://localhost:3001
PAYMENT_MOCK_MODE=true
NEXT_PUBLIC_PAYMENT_MOCK_MODE=false
ADMIN_API_KEY=dev-admin-key
```

이 설정은 로컬 화면 확인과 기본 동작 검증을 위한 것이다.

실제 운영에 필요한 Supabase, Toss, 문자/이메일, AI API 키는 아직 이 파일에 들어 있지 않다.

로컬 개발에서는 Supabase 키가 없어도 화면을 볼 수 있도록 `/api/events` 추적 요청은 202 응답으로 건너뛰게 했다. 운영 환경에서는 Supabase가 없으면 그대로 오류가 나도록 유지했다.

## 4. 프로젝트 성격

문서와 코드 기준으로 보면 이 프로젝트는 단순한 소개 홈페이지가 아니라, 다음 기능까지 포함한 웹앱 형태다.

- 홈페이지
- 서비스 목록
- 사례 페이지
- 사진 접수
- 견적/주문 생성 흐름
- 주문 상태 조회
- 관리자 화면
- 기술자 화면
- Supabase 데이터베이스 연동
- 사진 업로드/스토리지 연동
- 이벤트 추적
- FAQ/설정 관리

브랜드 관점에서는 아직 "프리미엄 생활 케어 브랜드"보다는 "홈서비스/교체/수리 예약형 MVP" 성격의 문구가 많이 남아 있다.

## 5. 주요 기술 구조

### 프레임워크

- Next.js App Router
- React 19
- TypeScript
- Supabase
- lucide-react 아이콘
- zod 검증

### 주요 폴더

`app/`

- 실제 페이지와 API 라우트가 들어 있다.
- Next.js App Router 구조다.

`components/`

- 홈페이지, 레이아웃, 견적, 주문 상태 등 재사용 컴포넌트가 있다.

`lib/`

- 데이터 로딩, Supabase 연결, 주문/견적/상태/카카오/스토리지/알림 같은 핵심 로직이 있다.

`supabase/migrations/`

- 데이터베이스 테이블, RLS, 인덱스, 운영 기능 확장 SQL이 들어 있다.

`scripts/`

- Supabase 적용, QA, 데이터 추출/검증용 스크립트가 있다.

`public/`

- 정적 이미지와 공개 자산이 들어 있다.

## 6. 주요 페이지 구조

### 공개 페이지

- `/`  
  홈페이지

- `/services`  
  서비스 목록/가격/견적 진입

- `/cases`  
  사례 목록

- `/request/photo`  
  사진 3장 접수 흐름

- `/quote/[serviceCode]`  
  서비스별 견적 상세/예약 흐름

- `/orders/lookup`  
  주문 조회

- `/orders/[id]`  
  주문 상태 상세

- `/privacy`  
  개인정보 처리방침

- `/refund-policy`  
  환불 정책

### 관리자 페이지

- `/admin`
- `/admin/login`
- `/admin/dashboard`
- `/admin/orders`
- `/admin/jobs`
- `/admin/diagnoses`
- `/admin/technicians`
- `/admin/slots`
- `/admin/analytics`
- `/admin/funnel`
- `/admin/settings`

### 기술자 페이지

- `/technician`
- `/technician/login`
- `/technician/[jobId]`

### API

- `/api/health`
- `/api/service-items`
- `/api/faqs`
- `/api/cases`
- `/api/diagnoses`
- `/api/quote`
- `/api/orders`
- `/api/slots`
- `/api/reviews`
- `/api/events`

## 7. 홈페이지 현재 상태

핵심 파일:

- `app/page.tsx`
- `app/home-client.tsx`
- `components/layout/Header.tsx`
- `components/layout/Footer.tsx`
- `app/globals.css`

현재 홈페이지는 다음 구조다.

1. 상단 헤더
2. 히어로 영역
3. 신뢰 요소 3개
4. 대표 서비스 카드
5. 진행 방식 안내
6. 사례/FAQ/하단 CTA

### 현재 히어로 문구

현재 히어로는 다음 방향의 문구를 사용한다.

- 사진 3장으로 제품 호환 확인하기
- 방문은 교체가 필요할 때만 진행합니다
- 변기, 수전, 조명, 콘센트처럼 제품 호환이 애매한 작업
- 사진확인
- 시공 사례 보기
- 카톡 상담

오른쪽 카드에는 다음 표현이 있다.

- photo diagnosis
- PHOTOS
- CHECK
- ESTIMATE
- 제품 호환
- 견적 안내
- photo compatibility check

### 브랜드 기준에서 보이는 문제

Build us Care가 "조용한 프리미엄 생활 케어 브랜드"로 가려면 현재 히어로는 다소 기능 설명형이다.

특히 아래 표현들은 사용자의 기존 브랜드 방향과 충돌할 수 있다.

- 제품 호환
- 견적
- 시공 사례
- 교체 중심 칩
- 정찰가/예약 중심 흐름

이 표현들은 고객에게 "감각적인 사진판정 서비스"보다는 "집수리/시공 예약 서비스" 느낌을 줄 수 있다.

다만 이 폴더는 예전 수정 폴더와 달리, 현재 원본에 가까운 상태라 디자인이 크게 무너져 있지는 않다. 앞으로 필요한 문구와 디자인만 골라서 바꾸면 된다.

## 8. 서비스 카드 현재 상태

대표 서비스 데이터는 `lib/service-items.ts`의 fallback 데이터와 Supabase 데이터를 함께 고려한다.

현재 기본 서비스에는 다음 항목이 있다.

- 변기 교체
- 수전 교체
- 전등 교체
- 콘센트 교체
- 도어핸들 교체
- 비데 설치
- 환풍기 교체

서비스 카드에는 가격/호환/사진 가이드/견적 진입 성격이 들어 있다.

브랜드 방향상 이 영역은 유지하더라도, 상단 히어로에서는 너무 직접적인 제품 나열을 줄이는 편이 더 적합하다.

## 9. 카카오톡 연결 상태

로컬 환경에는 카카오 채널 URL을 넣어두었다.

```env
NEXT_PUBLIC_KAKAO_CHANNEL_URL=https://pf.kakao.com/_PxkzsX?from=qr
```

코드에서는 `lib/kakao-channel.ts`가 이 주소를 카카오 채팅 주소 형태로 변환해 사용한다.

확인해야 할 것:

- 실제 카카오 채널 관리자에서 채팅 기능이 켜져 있는지
- 채널 공개 여부
- 모바일/데스크톱에서 열리는 동작
- 배포 환경에도 같은 환경 변수가 들어가 있는지

## 10. 현재 코드에서 자주 수정하게 될 파일

홈페이지 문구/레이아웃:

- `app/home-client.tsx`
- `components/home/HomeHero.tsx`
- `components/home/ServiceCard.tsx`
- `components/home/TrustMiniStrip.tsx`
- `components/home/BottomCTA.tsx`

전체 헤더/하단:

- `components/layout/Header.tsx`
- `components/layout/Footer.tsx`

전체 스타일:

- `app/globals.css`

서비스 데이터:

- `lib/service-items.ts`
- Supabase의 `service_items` 테이블

카카오 링크:

- `lib/config.ts`
- `lib/kakao-channel.ts`
- `.env.local`

메타 제목/검색 노출 문구:

- `app/layout.tsx`

## 11. 다음 작업 추천 순서

사용자가 보면서 수정할 때는 아래 순서가 효율적이다.

1. 홈 첫 화면 문구 정리
   - 가장 먼저 보이는 브랜드 인상을 정한다.
   - "집수리/시공 업체" 느낌을 줄인다.

2. 헤더 메뉴명 정리
   - `서비스`, `시공 사례`, `사진확인`, `주문 조회`가 현재 문구다.
   - 브랜드 방향에 맞게 `Care`, `사진으로 먼저`, `Care Note` 같은 표현을 쓸지 결정한다.

3. 대표 서비스 카드 정리
   - 아이콘, 영어 라벨, 카드 그림자, 품목명 위치 등을 다시 조정한다.
   - 예전 작업처럼 너무 수리업체 느낌이 나지 않게 주의한다.

4. 사진 접수 페이지 점검
   - 실제 고객이 사진 3장을 보내는 핵심 페이지다.
   - 문구, 업로드 흐름, 카카오 안내를 가장 중요하게 봐야 한다.

5. 서비스/사례 페이지 톤 조정
   - 현재는 견적/가격/시공 사례 성격이 강하다.
   - 브랜드 톤에 맞춰 "사진판정", "교체 가능 여부", "보류 가능" 중심으로 바꿀 수 있다.

6. 운영 기능 연결
   - Supabase 운영 DB
   - 배포 환경 변수
   - 카카오 채널
   - 실제 접수 테스트

## 12. 작업할 때 주의할 점

이 프로젝트는 단순 HTML 페이지가 아니라 기능이 많은 Next.js 앱이다.

따라서 작은 문구를 바꾸더라도 다음을 확인해야 한다.

- `npm run typecheck`
- `npm run build`
- 데스크톱 화면 확인
- 모바일 폭 화면 확인
- 카카오 버튼 링크 확인
- 사진 접수 페이지 동작 확인

특히 지금은 Git 저장소가 아니므로, 큰 변경 전에는 파일 백업이나 작업 기록을 남기는 것이 좋다.

## 13. 현재 결론

이 폴더는 다시 이어서 작업할 수 있는 상태다.

개발 서버:

`http://localhost:3001`

현재 가장 큰 과제는 기능 구현보다 브랜드 정리다.

기능 구조는 이미 많이 들어와 있으나, 화면 문구와 정보 설계가 아직 "프리미엄 생활 사진판정 브랜드"보다 "집수리/시공 예약 서비스" 쪽으로 읽히는 부분이 있다. 앞으로는 홈페이지 첫 화면부터 사진 접수 페이지까지 한 흐름으로 정리하면 된다.
