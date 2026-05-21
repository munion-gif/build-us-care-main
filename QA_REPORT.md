# QA 보고서 — 실제 운영 기준

검증일: 2026-05-11  
검증 환경: 프로덕션 운영 DB + 로컬 빌드 검증

## 고객 주문 현황 확인 흐름

| Step | 항목 | 결과 | 수정 내용 |
|---|---|---|---|
| A-1 | 주문 생성 후 고객용 현황 링크 전달 | ❌ | `POST /api/orders`의 `statusUrl`을 API 주소에서 `/orders/[id]?accessToken=...` 고객 화면 링크로 수정 |
| A-2 | 결제 완료 후 현황 확인 안내 | ❌ | `/orders/[id]`에 결제 완료 카드, 북마크 안내, 주문 현황 확인/공유 버튼 추가 |
| A-3 | 링크 분실 시 재조회 방법 | ❌ | `/orders/lookup` 페이지와 `POST /api/orders/lookup` 추가 |
| A-4 | accessToken만으로 주문 상태 조회 | ✅ | 기존 `/api/orders/:id/status` 토큰 검증 유지 |
| A-5 | 주문 상태 한글 표시 | ✅ | 기존 타임라인 유지, 상태별 고객 안내 문구 추가 |
| A-6 | 예약 날짜/시간 표시 | ⚠️ | 예약 카드 유지, 문의/담당 기사 정보 보강 |
| A-7 | 담당 기사 연락처 표시 | ❌ | 주문 상태 API에서 `jobs.technicians(name, phone)` 조인, 예약 카드에 기사 전화 또는 대표번호 표시 |
| A-8 | 결제 금액/수단 표시 | ⚠️ | 견적 카드에 결제 수단과 결제 금액 표시 추가 |
| A-9 | 예약 변경/취소 안내 | ❌ | 주문 상태 페이지에 카카오 상담/대표번호 기반 변경·취소 안내 추가 |
| A-10 | 완료 후 후기/A/S | ✅ | 기존 후기/A/S 버튼 유지 |

## 운영 DB 현재 상태

| 항목 | 결과 |
|---|---|
| 전체 주문 상태 | `inquiry 20`, `paid 11`, `payment_pending 2`, `submitted 2`, `warranty 2`, `issue 1`, `done 1`, `in_progress 1` |
| 최근 주문 access_token | 최근 5건 모두 `access_token` 존재 |
| 고객 현황 링크 구조 | `orders.access_token`으로 `/orders/[id]?accessToken=...` 접근 가능 |

## 시나리오별 QA 결과

| 시나리오 | Step | 결과 | 수정 여부 |
|---|---|---|---|
| B | B1 주문 생성 응답 | ⚠️ | `statusUrl` 고객 화면 링크로 수정 |
| B | B2 예약 생성 | ✅ | 기존 멱등 예약 로직 유지 |
| B | B3 견적 생성/수락 | ✅ | 기존 Phase 1 검증 유지 |
| B | B4 결제 confirm | ✅ | 기존 Toss/mock confirm 유지 |
| B | B5 미배정 주문 확인 | ✅ | `/api/admin/orders/unassigned-count` 사용 가능 |
| B | B6 기사 배정 | ✅ | 관리자 배정 UI/API 보강 완료 |
| B | B7 기사 앱 오늘 일정 | ⚠️ | 기존 기사 앱 API 존재. 이번 QA에서는 고객 주문 현황 중심으로 코드 경로 확인 |
| B | B8-B10 시공/검수 상태 | ✅ | 기존 관리자 jobs API 유지 |
| B | B11 후기 중복 방지 | ✅ | 기존 `feedbacks` 중복 방지 유지 |
| B | B12 A/S 접수 | ✅ | 기존 warranty API 유지 |
| C | 고객 예약 취소 | ⚠️ | 고객 직접 취소 버튼은 미제공. 카카오/대표번호 문의 안내 추가 |
| C | 관리자 취소 처리 | ✅ | `PATCH /api/admin/orders/:id` 추가, `cancelled` 입력도 `canceled`로 정규화 |
| D | 기사 변경 | ✅ | `DELETE /api/admin/jobs/:id` 배정 취소 후 재배정 가능 |
| D | 고객 알림 | ⚠️ | 자동 알림은 아직 mock/queued 중심. 상태 페이지에 변경 확인 안내 보강 |
| E | 견적 후 결제 이탈 | ⚠️ | `payment_pending` 상태는 존재. 재결제 버튼은 별도 후속 작업 필요 |

## 발견된 문제 및 수정 내역

| 구분 | 문제 내용 | 수정 여부 | 수정 내용 |
|---|---|---|---|
| 고객 링크 | 주문 생성 응답 `statusUrl`이 고객 화면이 아닌 API 주소 | ✅ | `/orders/[id]?accessToken=...`로 수정 |
| 고객 재방문 | 주문 현황 링크를 잃어버리면 조회 경로 없음 | ✅ | `/orders/lookup`, `POST /api/orders/lookup` 추가 |
| 결제 완료 UX | 성공 후 북마크/공유 안내 부족 | ✅ | 결제 완료 카드와 공유 버튼 추가 |
| 주문 상태 정보 | 결제 수단, 기사 연락처, 취소 문의 안내 부족 | ✅ | 카드 정보 보강 |
| 관리자 취소 | `/api/admin/orders/:id` 직접 상태 변경 API 없음 | ✅ | PATCH route 추가 |
| 기사 정보 | 고객용 status API가 기사 관계를 조인하지 않음 | ✅ | `jobs.technicians(name, phone)` 조인 추가 |

## 배포 후 확인

- `/` 200 OK
- `/quote/toilet_replace` 200 OK
- `/orders/lookup` 200 OK
- `POST /api/orders/lookup` 실제 운영 전화번호 기준 링크 반환 확인
  - 응답: `BO-20260508-0024` 주문 현황 링크 반환

## 수정하지 않은 항목 (이유 포함)

- 고객 직접 예약 취소 버튼: 결제/환불 정책이 확정되지 않아 직접 취소는 보류. 현재는 카카오 상담 또는 대표번호로 안내.
- 결제 이탈 고객 재결제 버튼: 기존 주문/견적을 재사용하는 정책과 Toss 재결제 플로우를 별도 정의해야 해서 후속 작업으로 분리.
- 기사 변경 자동 알림: 실제 SMS/카카오 알림톡 사업자 연결 전까지는 `notifications` 기록과 수동 연락으로 운영.

## 운영 시 주의사항

- 고객 주문 현황 링크는 `/orders/[id]?accessToken=...` 형태이며, 전화번호 기반 재조회는 `/orders/lookup`에서 가능.
- 예약 취소와 기사 변경은 현재 관리자/운영자가 처리하고 고객에게 수동 안내해야 함.
- 결제 이탈 고객은 `payment_pending` 또는 `inquiry` 상태로 남을 수 있어 관리자 분석 화면에서 후속 관리 필요.
