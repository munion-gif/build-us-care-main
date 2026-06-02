# Build us Care Operations

운영 중 반복해서 확인해야 하는 배포, 관리자 접근, DB, 검색 등록 절차를 모아둔 문서입니다.

## 문서 목록

| 문서 | 용도 |
| --- | --- |
| `deploy-checklist.md` | 브랜치, 빌드, Vercel 배포, 주요 URL 확인 |
| `admin-access.md` | 관리자 접속, IP 허용 목록, 임시 자동진입 해제 절차 |
| `database-guide.md` | 주문/사진판정/운영 데이터 테이블과 테스트 데이터 처리 |
| `seo-checklist.md` | 구글/네이버 검색 등록, sitemap, 수집 요청 URL |

## 운영 원칙

- 비밀값은 문서에 적지 않는다. 환경변수 이름과 설정 위치만 기록한다.
- 운영 DB 삭제/정리는 관리자 휴지통 흐름 또는 Supabase에서 명확히 확인한 뒤 처리한다.
- main 배포 전에는 `npm run typecheck`, `npm run build`, 주요 URL 200 확인을 기본으로 한다.
- 런칭 전에는 임시 설정인 `ADMIN_IP_BYPASS_LOGIN`을 끄거나 제거한다.
