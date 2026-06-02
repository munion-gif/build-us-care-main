# Deploy Checklist

Build us Care 운영 배포 전후 확인 절차입니다.

## 현재 기준

| 항목 | 값 |
| --- | --- |
| 운영 도메인 | `https://builduscare.co.kr` |
| Vercel 프로젝트 | `buildus-site` |
| Vercel scope | `munion-1750s-projects` |
| 작업 브랜치 | `work/manage-20260527` |
| 운영 브랜치 | `main` |

## 배포 전 확인

1. 작업 브랜치 상태 확인

```powershell
git status --short --branch
```

2. 타입체크와 빌드

```powershell
npm run typecheck
npm run build
```

3. main에 들어갈 커밋 확인

```powershell
git fetch origin
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```

4. 환경변수 변경 여부 확인

```powershell
vercel env ls --scope munion-1750s-projects
```

비밀값은 출력하거나 문서에 남기지 않는다.

## 배포 절차

작업 브랜치에 먼저 푸시한다.

```powershell
git push origin HEAD:manage-20260527
```

main 반영이 필요한 경우 fast-forward로 반영한다.

```powershell
git checkout main
git merge --ff-only work/manage-20260527
git push origin main
```

Vercel 자동 배포가 잡히지 않거나 즉시 반영해야 하면 직접 배포한다.

```powershell
vercel --prod --yes
```

## 배포 후 확인

도메인이 최신 Production 배포를 가리키는지 확인한다.

```powershell
vercel inspect https://builduscare.co.kr
```

주요 공개 URL이 200인지 확인한다.

```powershell
$urls=@(
  "https://builduscare.co.kr/",
  "https://builduscare.co.kr/services",
  "https://builduscare.co.kr/request/photo",
  "https://builduscare.co.kr/orders/lookup"
)
foreach($u in $urls){
  $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 20
  "$u $($r.StatusCode)"
}
```

관리자 접근을 확인한다.

```powershell
Invoke-WebRequest -Uri "https://builduscare.co.kr/admin" -UseBasicParsing -MaximumRedirection 0
```

## 배포 전 주의 항목

- `backups/`, `.env*`, `.next/`, `node_modules/`는 배포/커밋 대상이 아니다.
- 운영 DB에 영향을 주는 migration, 삭제, 환경변수 변경은 문서 작업과 분리해서 처리한다.
- `ADMIN_IP_BYPASS_LOGIN`은 임시 확인용이다. 런칭 전에는 끄거나 제거한다.
- 배포 후 주문 생성, 사진확인 접수, 관리자 주문 목록은 운영 DB에 실제 데이터를 만들 수 있으므로 테스트 여부를 명확히 구분한다.
