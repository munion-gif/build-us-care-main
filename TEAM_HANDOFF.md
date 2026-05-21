# Buildus Care Team Handoff

팀 공유용 운영/확인 문서입니다. 코딩을 모르는 팀원도 현재 배포 상태와 확인 위치를 빠르게 찾을 수 있도록 정리했습니다.

## 현재 배포 주소

- 사용자 사이트: https://builduscare.co.kr
- Vercel 기본 주소: https://buildus-care-flow.vercel.app
- 사진확인 페이지: https://builduscare.co.kr/request/photo

## GitHub 저장소

- 저장소: https://github.com/jun-c0de/build-us-care
- 기본 브랜치: `main`

팀원은 GitHub에서 파일을 직접 수정하기보다, 확인/공유/이슈 정리 용도로 보는 것을 권장합니다.

## 환경변수 파일 안내

실제 실행에 필요한 환경변수 구조는 `.env.example`에 정리되어 있습니다.

중요한 점:

- `.env.local`은 실제 비밀값이 들어갈 수 있어서 GitHub에 올리지 않습니다.
- Supabase service role key, Toss key, Solapi key, admin secret 같은 값은 유출되면 운영 데이터나 결제/문자 기능에 영향을 줄 수 있습니다.
- 팀원이 로컬에서 실행해야 할 일이 생기면 개발자가 `.env.example`을 복사해서 `.env.local`을 만들고, 필요한 값을 따로 전달해 세팅합니다.

## 로그 파일 안내

로컬에 있는 `*.log` 파일들은 개발 서버를 켜고 끄면서 생긴 임시 실행 기록입니다.

GitHub에는 원본 로그 파일을 올리지 않습니다. 이유는 다음과 같습니다.

- 대부분 로컬 PC 경로, 포트, 임시 오류 기록이라 팀원이 읽어도 의미가 적습니다.
- 오래된 개발 서버 오류가 섞여 있어 현재 배포 상태와 다를 수 있습니다.
- 일부 로그에는 환경 경로나 설정 단서가 들어갈 수 있습니다.

대신 현재 상태 확인용 문서는 레포에 포함되어 있습니다.

- `STATUS_REVIEW_2026-05-20.md`: 현재 기능/UI/UX 진행 상황
- `ADMIN_DASHBOARD_REPORT.md`: 관리자 화면 점검 내용
- `EXCEL_STAGE_QA_REPORT.md`: 엑셀 기준 완료/미완료 정리
- `QA_REPORT.md`: QA 기록
- `UI_UX_VERIFICATION.md`: UI/UX 검수 기록

## 팀원이 문제를 발견했을 때 전달할 정보

문제가 생기면 아래 정보만 정리해서 개발자에게 전달하면 됩니다.

1. 문제가 생긴 주소
2. 어떤 버튼을 눌렀는지
3. 기대한 결과
4. 실제로 나온 화면 또는 오류
5. 가능하면 캡처 이미지

예시:

```text
주소: https://builduscare.co.kr/request/photo
동작: 사진확인에서 변기 교체 선택 후 다음 버튼 클릭
기대: 사진 업로드 단계로 이동
실제: 버튼을 눌러도 반응 없음
캡처: 이미지 첨부
```

## 개발자가 로컬에서 실행할 때

```bash
npm install
npm run dev
```

기본 로컬 주소는 아래와 같습니다.

```text
http://localhost:3000
```

환경변수가 필요한 기능은 `.env.example`을 참고해 `.env.local`을 만든 뒤 실행합니다.
