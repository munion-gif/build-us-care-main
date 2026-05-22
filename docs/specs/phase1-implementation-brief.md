# Buildus Care Phase 1 구현 브리핑

작성일: 2026-05-07  
기준 문서: `backend-spec.md`, `빌드어스_데이터수집매뉴얼_v1_2026-05-07.xlsx`

## 1. 현재 결론

지금 프로젝트는 단순 예약 웹앱이 아니라 **집수리/시공 운영 OS의 Phase 1 백엔드**로 방향을 잡는 것이 맞습니다.

엑셀 원본, 현재 MVP 코드, 퍼플렉시티 리뷰, 코덱스 검토가 모두 같은 방향으로 수렴했습니다.

핵심은 화면 기능을 더 붙이는 것이 아니라, 고객 입력부터 견적, 결제, 예약, 기사 작업, 사진, 검수, 후기까지 이어지는 운영 데이터 구조를 먼저 고정하는 것입니다.

## 2. Phase 1 목표

Phase 1 목표는 다음입니다.

- 고객, 집, 주문, 견적, 결제, 작업, 사진, 검수, 후기, 기사, 자재 데이터를 하나의 흐름으로 연결
- 주문과 작업을 분리해 상업 기록과 현장 운영 기록을 따로 관리
- 사진/후기/검수 데이터를 향후 AI 견적, AI 검수, 시공자 매칭의 학습 자산으로 축적
- Supabase RLS와 서버 API 중심 구조로 개인정보 보호 기준 확립

## 3. 핵심 도메인 구조

Phase 1의 핵심 흐름은 아래와 같습니다.

```text
customers
  -> homes
  -> orders
  -> quotes
  -> payments
  -> jobs
  -> media
  -> inspections
  -> feedbacks
```

보조 운영 데이터는 다음과 같습니다.

```text
technicians
materials
payment_events
warranty_cases
```

## 4. 가장 중요한 설계 결정

### orders와 jobs 분리

`orders`는 고객이 구매한 상업 단위입니다.

`jobs`는 실제 현장에서 기사와 자재, 작업 시간, 이슈, 완료 보고를 관리하는 운영 단위입니다.

현재 MVP는 주문 1건당 작업 1건이지만, 나중에는 주문 1건이 여러 작업으로 나뉠 수 있습니다.

### 주소 기준

실제 방문 주소의 기준은 `homes.address_full`입니다.

`customers.address_full`은 운영 편의를 위한 최근/기본 주소 스냅샷으로만 사용합니다.

### 견적 기준

금액 계산은 프론트가 아니라 서버가 합니다.

결제는 반드시 고객이 수락한 최신 `quotes` 기준 금액과 일치해야 합니다.

### 결제 기준

`payments.status`는 빌드어스 내부 결제 상태입니다.

Toss의 원본 상태값은 `payment_events.payload`에 저장하고, 내부 로직은 내부 상태값 기준으로 처리합니다.

### 보안 기준

브라우저가 민감 테이블을 직접 조회하지 않습니다.

모든 민감 데이터 접근은 Next.js Route Handler에서 service role key로 처리합니다.

게스트 주문 조회는 `accessToken`을 API에서 검증한 뒤, 마스킹된 정보만 반환합니다.

## 5. 현재까지 완료된 작업

### 문서

- `backend-spec.md`를 Phase 1 백엔드 기준 문서로 정리
- 엑셀 원본의 Stage 0/P0 구조 반영
- 상태값, 테이블, API, 결제, 웹훅, RLS, 보안 정책 정리
- 기존 MVP 상태값과 Phase 1 상태값 매핑표 추가
- `service_items`, `materials`, `products/product_options` 역할 정리

### 마이그레이션 초안

새 마이그레이션 파일을 추가했습니다.

```text
supabase/migrations/202605070001_phase1_schema.sql
```

이 파일은 기존 MVP를 바로 깨지 않도록 확장형으로 작성했습니다.

추가 테이블:

- `homes`
- `quotes`
- `technicians`
- `materials`
- `media`
- `inspections`
- `feedbacks`
- `warranty_cases`

확장 테이블:

- `customers`
- `orders`
- `payments`
- `jobs`

포함된 작업:

- Phase 1 enum 추가
- 기존 `order_photos`를 `media`로 이전
- 기존 `reviews`를 `feedbacks`로 이전
- 주요 인덱스 추가
- 새 테이블 RLS 활성화
- service role 전용 정책 추가

## 6. DB 적용 결과

테스트 DB에 Phase 1 마이그레이션 4개를 순차 적용했습니다.

적용 결과:

- DB 연결 확인 성공
- `202605070001_phase1_foundation.sql` 적용 성공
- `202605070002_phase1_existing_table_expansion.sql` 적용 성공
- `202605070003_phase1_data_backfill.sql` 적용 성공
- `202605070004_phase1_indexes_rls.sql` 적용 성공
- `phase1_backfill_checks.sql` 실행 성공

주의: 검증 SQL은 기존 스크립트에서 SELECT 결과를 출력하지 않아, 실행 성공만 확인된 상태였습니다. 이후 스크립트를 보강해 SELECT 결과를 콘솔에 출력하도록 수정했습니다.

## 7. 다음 작업 순서

권장 순서는 아래와 같습니다.

1. `phase1_backfill_checks.sql`을 다시 실행해 SELECT 결과를 확인
2. 결과를 `CHANGES_PHASE1.md`에 기록
3. `/api/orders`를 `customer + home + order` 생성 구조로 변경
   - `customers.acquisition_source`
   - `orders.channel`
   - `orders.reason`
   - `orders.urgency`
   - `homes.year_built`
   - `orders.skus`
   - `orders.self_diagnosis`
4. `/api/quote`를 `quotes` 저장 구조로 변경
5. Toss 결제를 수락된 최신 `quotes` 기준으로 검증
6. 사진 API를 `order_photos`에서 `media` 기준으로 전환
7. 후기 API를 `reviews`에서 `feedbacks` 기준으로 전환
8. 관리자/기사 작업 API를 `jobs`, `technicians`, `materials`, `inspections` 기준으로 확장
9. 마지막으로 현재 `/flow` UI를 새 API 구조에 연결

## 8. 팀 공유용 한 줄 요약

현재 Buildus Care는 예약 웹앱 화면을 넘어서, 고객 의뢰부터 견적, 결제, 예약, 기사 작업, 사진, 검수, 후기까지 이어지는 Phase 1 운영 데이터 구조를 확정하는 단계입니다. 백엔드 스펙은 정리됐고, 이제 Supabase 마이그레이션과 API 리팩터링으로 넘어가면 됩니다.
