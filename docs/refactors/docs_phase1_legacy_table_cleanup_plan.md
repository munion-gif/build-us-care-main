# Phase 1 legacy table cleanup plan

목적: Phase 1 API 전환 후 남은 MVP 레거시 테이블을 안전하게 정리하기 위한 후보 목록입니다.

## 바로 삭제하지 않은 이유

DB 테이블 삭제는 되돌리기 어려운 데이터 손실 작업입니다. 현재 테스트 DB에는 Step 1~6 검증 데이터가 계속 쌓여 있고, 일부 레거시 API도 아직 남아 있으므로 삭제는 별도 승인 후 진행합니다.

## 삭제 후보

| 후보 | 대체 테이블 | 현재 상태 |
| --- | --- | --- |
| `order_photos` | `media` | Step 4 이후 새 media API는 사용하지 않음 |
| `reviews` | `feedbacks` | Step 5 이후 새 feedback API는 사용하지 않음 |
| `addresses` | `homes` | Step 1 이후 주문 생성은 `homes` 기준 |
| `order_items` | `orders.skus` + `quotes.items` | Step 1~2 이후 새 플로우는 quote/items JSON 기준 |
| `products` | `service_items` + `materials` | 현재 코드 참조 없음. 단, 카탈로그 정책 확정 전 삭제는 보류 권장 |

## 아직 유지 권장

| 테이블 | 이유 |
| --- | --- |
| `reservations` | 예약 API가 아직 Step 6 범위 밖이며, Step 7 이후 상태 조회와 연결 필요 |
| `notifications` | 알림/운영 이력 확장에 사용할 수 있음 |
| `job_status_logs` | Step 6에서 계속 사용 |

현재 코드 grep 결과:

- `products`: 직접 참조 없음. 삭제 후보로 추가 가능하지만, 카탈로그/서비스 상품 정책 확정 전까지는 실제 삭제 보류.
- `reservations`: `/api/orders/:id/reservation`, `/api/orders/:id/status`, 관리자 주문 조회, `/flow`에서 참조 중이므로 유지.

## 권장 삭제 순서

1. Step 7 게스트 상태 조회 마스킹까지 완료
2. 레거시 API `/api/reviews`, `/api/orders/:id/photos` 사용 여부 확인
3. 백업 또는 dump 생성
4. 백필 검증 재실행
5. 삭제 마이그레이션 작성
6. 테스트 DB에서 삭제 검증
7. 운영 DB 반영

## 삭제 마이그레이션 예시

아래는 예시이며, 실제 실행 전 별도 승인과 백업이 필요합니다.

```sql
drop table if exists public.reviews;
drop table if exists public.order_photos;
```
