# SEO Checklist

구글 Search Console과 네이버 Search Advisor 등록/점검 기준입니다.

## 기본 URL

| 항목 | URL |
| --- | --- |
| 운영 도메인 | `https://builduscare.co.kr` |
| sitemap | `https://builduscare.co.kr/sitemap.xml` |
| robots | `https://builduscare.co.kr/robots.txt` |

## 필수 수집 요청 URL

우선 수집 요청할 URL:

```text
https://builduscare.co.kr/
https://builduscare.co.kr/services
https://builduscare.co.kr/request/photo
https://builduscare.co.kr/orders/lookup
https://builduscare.co.kr/quote/toilet_replace
https://builduscare.co.kr/quote/basin_replace
https://builduscare.co.kr/quote/faucet_replace
https://builduscare.co.kr/quote/bidet_install
https://builduscare.co.kr/quote/ventilator_replace
https://builduscare.co.kr/quote/sash_handle
https://builduscare.co.kr/quote/door_handle
https://builduscare.co.kr/quote/silicone_repair
```

## Google Search Console

1. 도메인 속성으로 `builduscare.co.kr` 등록
2. DNS TXT 인증 추가
3. 소유권 확인
4. sitemap 제출
5. 주요 URL 검사 후 색인 생성 요청

DNS TXT 레코드는 삭제하지 않는다. 삭제하면 소유권 확인이 실패할 수 있다.

## Naver Search Advisor

1. 사이트 등록
2. 메타태그 또는 HTML 파일 방식으로 소유권 확인
3. sitemap 제출
4. robots.txt 수집 가능 여부 확인
5. 주요 URL 수집 요청
6. URL 검사에서 아래 항목이 초록 체크인지 확인

확인 항목:

- 페이지 정상 접속 여부
- robots.txt 접근 가능
- 서버 응답 200
- 로봇 메타 태그 정상
- 페이지 제목
- 페이지 설명
- Open Graph 제목
- Open Graph 설명

## 메타 정보 기준

현재 대표 문구:

```text
Build us Care
집 안의 작은 교체, 먼저 확인하세요
```

링크 공유 대표 이미지는 Open Graph 이미지로 설정한다.

## 운영 주의

- 관리자, API, 실험 페이지는 검색 노출 대상이 아니다.
- `/admin/`, `/api/`, `/lab/`은 색인되지 않아야 한다.
- sitemap에 없는 페이지라도 직접 수집 요청할 수 있지만, 운영에 필요한 공개 페이지 위주로 요청한다.
- 제목/설명 변경 후에는 구글/네이버에 즉시 반영되지 않을 수 있다. 캐시 갱신까지 시간이 걸린다.
