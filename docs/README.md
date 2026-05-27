# Build us Care Docs

이 폴더는 앱 실행 코드와 운영/기획 문서를 분리하기 위해 정리한 문서 보관소입니다.

## 폴더 구조

| 폴더 | 내용 |
| --- | --- |
| `specs/` | 백엔드 스펙, 아키텍처, 로드맵, 인수인계 문서 |
| `reports/` | QA, 성능, 상태 점검, 경쟁사/운영 분석 보고서 |
| `changelog/` | Phase 1 변경 로그와 배포 리포트 |
| `refactors/` | 기능별 리팩터링 검토 및 테스트 문서 |
| `data/` | 운영 데이터 엑셀, 데이터 수집 매뉴얼, 로컬 FAQ JSON |

## 자주 보는 문서

- 백엔드 기준 스펙: `specs/backend-spec.md`
- 현재 구조 분석: `specs/PROJECT_ARCHITECTURE_OVERVIEW.md`
- 웹 타이포그래피 시스템: `specs/builduscare_typography_system_research.md`
- 로드맵: `specs/ROADMAP.md`
- 전체 진행 기록: `reports/PROJECT_PROGRESS_FULL.md`
- Phase 1 변경 로그: `changelog/CHANGES_PHASE1.md`

## 로컬 산출물

개발 서버 로그와 ui-inspector 실행 로그는 `.runtime/logs/` 아래에만 둡니다. 화면 캡처와 문서 생성 결과는 각각 `screenshots/`, `outputs/`를 사용하고, 루트에는 임시 HTML이나 로그 파일을 남기지 않습니다.
