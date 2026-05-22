# Deploy OrderStatus Alignment

작성일: 2026-05-13

## 목적

- 축 A: `https://buildus-care-flow.vercel.app/` 프로덕션 배포본이 로컬 OrderStatus 정리 코드와 일치하는지 확인한다.
- 범위는 확인과 정렬 전략 수립까지다. 실제 배포는 실행하지 않았다.

## 확인한 Vercel 배포 기준

| 항목 | 확인 결과 |
| --- | --- |
| Vercel project | `.vercel/project.json` 기준 `buildus-care-flow` |
| projectId | `prj_J6c8Auv8k6BSJau7hPJZagbVeyjK` |
| orgId | `team_H3wQrsN9KqDr77rFG8COorhr` |
| production deployment id | `dpl_DHoZ7a1UbXAUpjgkcxLmYVLS9ooR` |
| deployment URL | `buildus-care-flow-gdxy2pc1s-juns-projects-58815d6e.vercel.app` |
| alias | `buildus-care-flow.vercel.app` |
| target | `production` |
| readyState | `READY` |
| createdAt | 2026-05-12 16:19:42 KST |
| contextName | `juns-projects-58815d6e` |
| gitSource | `null` |

`vercel inspect https://buildus-care-flow.vercel.app --json` 결과에는 Git branch, commit SHA, repository 정보가 포함되어 있지 않았다.

## 로컬 Git 기준 확인 결과

| 항목 | 확인 결과 |
| --- | --- |
| 현재 브랜치 | `master` |
| `HEAD` | 없음. `git rev-parse HEAD`가 실패함 |
| remote | 없음 |
| OrderStatus 관련 파일 상태 | 모두 untracked |

현재 로컬 저장소는 Git 커밋 기준의 `HEAD`가 없기 때문에, 요청한 "배포 기준 커밋 vs 현재 HEAD diff"는 실제 Git diff로 계산할 수 없다.

## 런타임 기준 불일치 근거

`QA_ORDER_STATUS_VERIFICATION.md` 실행 검증에서 프로덕션 API는 로컬 OrderStatus 기준과 다르게 동작했다.

| 시나리오 | 로컬 코드 기준 기대 | Vercel 실제 결과 | 판단 |
| --- | --- | --- | --- |
| `inquiry -> quoted` | 허용 | `400 VALIDATION_ERROR` | 불일치 |
| `inquiry -> payment_pending` | 차단 | `200 OK` | 불일치 |
| `completed -> warranty` | 차단 | `200 OK` | 불일치 |
| `scheduled -> done` | 차단 | `409 CONFLICT` | 일치 |
| `canceled -> paid` | 차단 | `409 CONFLICT` | 일치 |
| completed 상태 고객 A/S API | 차단 | `400 ORDER_NOT_COMPLETED` | 일치 |

따라서 프로덕션 배포본은 최소한 OrderStatus 검증/전이 로직 일부가 현재 로컬 코드와 다르다.

## OrderStatus 관련 파일 비교 요약

정확한 소스 diff는 배포 커밋과 로컬 `HEAD`가 확인되지 않아 계산하지 못했다. 아래 표는 로컬 파일의 현재 기준과, 프로덕션 런타임 불일치가 직접 관련되는지 여부를 정리한 것이다.

| 파일 | 로컬 기준 확인 내용 | 배포본과의 차이 판단 |
| --- | --- | --- |
| `lib/types.ts` | 공식 운영 상태 12개에 `quoted` 포함, legacy 상태 별도 유지, `cancelled -> canceled` alias 정규화 | `quoted` 검증 실패와 직접 관련 가능성이 큼 |
| `lib/validation.ts` | `orderStatusInputSchema`가 `OPERATIONAL_ORDER_STATUSES` subset만 허용하고 alias 정규화 | `inquiry -> quoted` 400, `cancelled` 정규화와 직접 관련 가능성이 큼 |
| `lib/status.ts` | `inquiry -> quoted` 허용, `inquiry -> payment_pending` 차단, `completed -> warranty` 차단 | 프로덕션 전이 결과와 직접 불일치 |
| `lib/format.ts` | 상태 표시 formatting에서 alias/운영 상태 라벨 사용 | 런타임 API 전이 불일치와는 간접 관련 |
| `lib/order-status-label.ts` | `submitted/draft -> inquiry`, `reservation_pending -> payment_pending`, `reservation_confirmed/preparing -> scheduled`, `in_service -> in_progress`, `cancelled -> canceled` 라벨 정규화 | UI 라벨 정렬과 관련 |
| `app/api/admin/orders/[id]/status/route.ts` | `orderStatusPatchSchema` 검증 후 `canTransitionOrder`로 전이 제한 | 프로덕션 전이 결과와 직접 불일치 |
| `app/api/admin/orders/[id]/route.ts` | 관리자 상세 PATCH에서 `orderStatusInputSchema` 사용. 전이 FSM 검증은 적용하지 않음 | 관리자 범용 수정 API의 상태 변경 경로로 영향 가능 |
| `app/admin/orders/page.tsx` | 상태 필터가 `OPERATIONAL_ORDER_STATUSES` 기준 | 프로덕션 UI 필터가 오래된 빌드면 불일치 가능 |
| `app/admin/dashboard/page.tsx` | `formatOrderStatus` 기반 badge/라벨 표시 | UI 라벨 정렬과 관련 |
| `app/orders/[id]/order-status-client.tsx` | 고객 화면에서 alias 상태를 UI 상태로 정규화 | 고객 상태 라벨/가이드와 관련 |
| `components/orders/NextActionCard.tsx` | A/S CTA primary action은 `orderStatus === "done"` 기준 | completed 고객 A/S API 차단 결과와 일치 |
| `components/orders/OrderCurrentStatusPanel.tsx` | `getOrderStatusLabel` 기반 상태 패널 표시 | UI 라벨 정렬과 관련 |
| `app/flow/page.tsx` | QA flow 화면에서 OrderStatus 라벨/흐름 확인 용도 | 수동 QA 보조 화면 |

## 정렬 전략 제안

현재 확인 가능한 사실은 "Vercel 배포 메타데이터에 Git source가 없고, 로컬 저장소도 커밋 기준이 없어 배포 소스와 로컬 소스를 Git으로 직접 비교할 수 없다"는 것이다.

권장 정렬 순서:

1. 현재 로컬 OrderStatus 정리 코드를 Git 커밋 또는 배포 가능한 기준점으로 고정한다.
2. DB `orders_status_check`에 `quoted`와 legacy 호환 상태를 포함하는 migration을 먼저 적용한다.
   - 완료: `2026-05-13`, `supabase/migrations/202605130002_add_quoted_to_orders_status_check.sql`.
   - `orders_status_check`는 `quoted`, `reservation_pending`을 포함하며 `VALIDATE CONSTRAINT`까지 통과했다.
   - 반대로 코드 배포를 먼저 하면 `inquiry -> quoted`가 코드상 허용된 뒤 DB CHECK에서 실패할 수 있었다.
3. 같은 Vercel project link에서 현재 로컬 기준을 production으로 배포한다.
4. 배포 후 OrderStatus 전이와 UI 라벨을 다시 검증한다.

예상 명령 순서:

```bash
npm run typecheck
npm run build

# 별도 승인 후 DB migration 적용
# supabase migration up 또는 운영 배포 절차에 맞춘 SQL 적용

vercel --prod
vercel inspect https://buildus-care-flow.vercel.app --json
```

GitHub 연동 배포를 사용할 경우에는 먼저 repository remote, production branch, Vercel project Git integration을 확인한 뒤 해당 branch에 커밋을 push하는 방식으로 정렬해야 한다.

## 배포 후 재검증 목록

| 시나리오 | 기대 결과 |
| --- | --- |
| `inquiry -> quoted` | 허용 |
| `quoted -> payment_pending` | 허용 |
| `inquiry -> payment_pending` | `409 CONFLICT` |
| `completed -> warranty` | `409 CONFLICT` |
| `done -> warranty` | 허용 |
| `scheduled -> done` | `409 CONFLICT` |
| `canceled -> paid` | `409 CONFLICT` |
| 고객 completed 상태 A/S API | 차단 |
| 고객 done 상태 A/S CTA/API | 허용 |
| 관리자 상태 필터 | 공식 운영 상태 12개 기준 |

## 배포 후 재검증 결과

검증일: 2026-05-13

배포 기준:

| 항목 | 값 |
| --- | --- |
| 로컬 브랜치 | `master` |
| Git commit | 없음. `git rev-parse HEAD` 실패 |
| 배포 기준 | 현재 로컬 워크스페이스 파일 트리 |
| Vercel project | `buildus-care-flow` |
| production deployment id | `dpl_4f1fDXsBLDQg9pxNaZUuELRYSoRD` |
| deployment URL | `buildus-care-flow-mk3su65mv-juns-projects-58815d6e.vercel.app` |
| production alias | `https://buildus-care-flow.vercel.app` |
| createdAt | 2026-05-13 15:08:01 KST |
| 배포 명령 | `vercel --prod` |

실행/검증 명령:

```powershell
npm run typecheck
npm run build
vercel --prod
vercel inspect https://buildus-care-flow.vercel.app --json
node scripts\qa-order-status-production.js
```

결과:

| 시나리오 | 실제 결과 | 판단 |
| --- | --- | --- |
| `inquiry -> quoted` | `200 OK`, 최종 `quoted` | 통과 |
| `quoted -> payment_pending` | `200 OK`, 최종 `payment_pending` | 통과 |
| `inquiry -> payment_pending` | `409 CONFLICT`, 최종 `inquiry` 유지 | 통과 |
| `completed -> warranty` | `409 CONFLICT`, 최종 `completed` 유지 | 통과 |
| `done -> warranty` | `200 OK`, 최종 `warranty` | 통과 |
| `scheduled -> done` | `409 CONFLICT`, 최종 `scheduled` 유지 | 통과 |
| `canceled -> paid` | `409 CONFLICT`, 최종 `canceled` 유지 | 통과 |
| completed 상태 고객 A/S API | `400 ORDER_NOT_COMPLETED` | 통과 |
| completed 상태 고객 화면 | rendered DOM에서 A/S CTA 없음 | 통과 |
| done 상태 고객 A/S CTA | rendered DOM에서 `A/S가 필요하신가요?`, `A/S 신고하기` 확인 | 통과 |
| done 상태 고객 A/S API | `201 Created`, 주문 status `warranty` 전환 | 통과 |

QA 데이터:

- `scripts/qa-order-status-production.js`가 QA 주문/고객을 생성 후 삭제했다.
- `special_requests = 'QA_ORDER_STATUS_PRODUCTION'` 잔여 주문 count는 `0`이다.

남은 예외/리스크:

- Git commit `HEAD`와 Vercel Git source가 없어 SHA 기반 배포 추적은 불가하다.
- 고객 화면은 Chrome headless DOM으로 CTA 렌더링을 확인했다. 모달 클릭 후 제출 버튼의 시각 상태는 API 생성 성공으로 대체 검증했다.
- jobs/기사 legacy status sync는 이번 작업 범위 밖이다.

## 주의 사항

- 현재 Vercel 배포가 Git commit 기반이 아닌 것으로 보이며, `gitSource`가 `null`이다.
- 로컬 저장소에 커밋과 remote가 없어 "어떤 커밋을 배포하면 되는지"를 SHA로 지정할 수 없다.
- DB CHECK 보정은 코드 배포 전에 완료됐다.
- production 배포와 배포 후 재검증까지 완료됐다.
