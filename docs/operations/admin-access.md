# Admin Access

관리자 페이지 접근 방식과 환경변수 운영 기준입니다.

## 관리자 URL

| 용도 | URL |
| --- | --- |
| 관리자 진입 | `https://builduscare.co.kr/admin` |
| 관리자 로그인 | `https://builduscare.co.kr/admin/login` |
| 보안 점검 | `https://builduscare.co.kr/admin/security` |

## 접근 제어 구조

관리자 경로는 middleware에서 먼저 보호한다.

- `/admin/*`
- `/api/admin/*`

현재 구조:

1. `ADMIN_ALLOWED_IPS`가 설정되어 있으면 허용 IP만 접근 가능
2. 허용 IP가 아니면 `/admin/login` 포함 관리자 경로 전체를 `404` 처리
3. `ADMIN_IP_BYPASS_LOGIN=1`이면 허용 IP에서 로그인 없이 관리자 화면 진입
4. `ADMIN_IP_BYPASS_LOGIN`이 꺼져 있으면 기존 비밀번호 로그인 사용

## 환경변수

| 이름 | 용도 | 운영 기준 |
| --- | --- | --- |
| `ADMIN_ALLOWED_IPS` | 관리자 접근 허용 IP 목록 | 운영 IP만 등록 |
| `ADMIN_IP_BYPASS_LOGIN` | 허용 IP 자동진입 | 임시 확인용, 런칭 전 제거 또는 `0` |
| `ADMIN_PASSWORD` | 관리자 비밀번호 | 충분히 긴 값 사용 |
| `ADMIN_SESSION_SECRET` | 관리자 세션 서명키 | 서버 전용 비밀값 |

비밀값은 문서, 로그, 화면 공유에 노출하지 않는다.

## 현재 IP 확인

관리자 접속이 막히면 먼저 접속 기기의 공인 IP를 확인한다.

```powershell
(Invoke-WebRequest -Uri "https://api.ipify.org?format=text" -UseBasicParsing).Content
```

브라우저에서는 아래 주소를 열어 확인한다.

```text
https://api.ipify.org
```

## IP 허용 목록 변경

Vercel Production 환경변수에서 `ADMIN_ALLOWED_IPS`를 수정한다.

여러 IP는 쉼표로 구분한다.

```text
61.79.96.212,203.0.113.10
```

변경 후에는 재배포가 필요하다.

```powershell
vercel --prod --yes
```

## 임시 자동진입 해제

런칭 전 또는 운영 보안을 강화할 때는 `ADMIN_IP_BYPASS_LOGIN`을 제거하거나 `0`으로 바꾼다.

해제 후 기대 동작:

- 허용 IP에서 `/admin` 접속 시 `/admin/login`으로 이동
- 비밀번호 로그인 후 대시보드 접근
- 미허용 IP는 계속 `404`

## 운영 주의

- IP 자동진입은 편하지만 같은 네트워크 사용자도 접근할 수 있다.
- 자동진입을 켠 상태에서는 개인정보 포함 다운로드, 완전삭제, 설정 변경 같은 민감 작업을 특히 주의한다.
- 관리자 화면은 `noindex` 처리되어 있고 robots에서도 `/admin/`이 차단된다.
