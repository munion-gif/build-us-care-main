# Build us Care 웹사이트/쇼핑몰 타이포그래피 시스템 조사 분석

작성일: 2026-05-27  
적용 대상: Build us Care 홈페이지, 견적 페이지, 제품 선택 페이지, 결제/예약 플로우, 향후 쇼핑몰형 상세페이지

---

## 1. 핵심 결론

Build us Care의 타이포그래피는 “예쁜 글자 크기”가 아니라 **신뢰, 선택, 결제, 안내를 구분하는 정보 설계**로 봐야 한다.  
특히 Build us Care는 일반 쇼핑몰도 아니고 공사업체도 아니며, “사진 먼저 확인하는 생활 제품 교체 서비스”이기 때문에 다음 원칙이 중요하다.

1. **본문은 작게 만들지 않는다.**  
   모바일 본문 16px, 데스크톱 본문 17px을 기본으로 한다.

2. **제목은 크기보다 역할로 구분한다.**  
   Hero, Section, Card, Body, Label, Caption을 역할별 토큰으로 나눈다.

3. **결제 영역은 총액보다 오늘 결제 금액을 크게 보여준다.**  
   Build us Care는 제품값만 온라인 결제하고, 시공비는 현장 결제한다. 그래서 가장 큰 숫자는 총액이 아니라 `제품값 선결제 금액`이어야 한다.

4. **폰트 굵기는 400, 500, 600, 700만 사용한다.**  
   300은 한국어에서 힘이 빠지고, 800/900은 공사업체 전단지처럼 보일 수 있다.

5. **줄높이는 제목과 본문을 다르게 잡는다.**  
   제목은 1.15~1.3, 본문은 1.55~1.7 범위가 좋다.

6. **한 줄 길이를 제한한다.**  
   본문/설명문은 max-width를 걸어야 고급스럽고 읽기 쉽다. Baymard는 본문 텍스트의 적정 줄 길이를 50~75자로 제시한다.

7. **가격 숫자는 명확하게, 가능하면 tabular numbers를 사용한다.**  
   Shopify Polaris도 통화/숫자 정렬에는 monospaced 장식이 아니라 tabular numbers를 권장한다.

---

## 2. 조사 근거 요약

### 2.1 Material Design 3

Material Design 3는 타이포그래피를 감으로 정하지 않고, `Display`, `Headline`, `Title`, `Body`, `Label` 같은 역할 기반 타입 스케일로 정리한다.  
Build us Care도 이 방식으로 가야 한다.

적용 해석:

- Hero Title = Display 또는 Headline 역할
- Section Title = Headline 역할
- Card Title = Title 역할
- Body Text = Body 역할
- Tag, Button, Form Label = Label 역할

출처:  
https://m3.material.io/styles/typography/applying-type  
https://m3.material.io/styles/typography/type-scale-tokens

---

### 2.2 Apple Human Interface Guidelines

Apple HIG는 모든 글자 크기에서 레이아웃과 글자가 읽히도록 적응해야 한다고 강조한다.  
Build us Care에 적용하면 “디자인상 예뻐 보여서 13px 본문을 쓰는 방식”은 피해야 한다.

적용 해석:

- 모바일 본문은 16px 이상
- 작은 안내문도 12px 미만 지양
- 긴 설명은 줄높이를 충분히 확보
- 확대/줌 환경에서도 결제 정보가 잘리지 않게 설계

출처:  
https://developer.apple.com/design/human-interface-guidelines/typography

---

### 2.3 WCAG 2.2 Text Spacing

WCAG 2.2의 Text Spacing 기준은 사용자가 텍스트 간격을 조정해도 콘텐츠나 기능 손실이 없어야 한다고 설명한다. 기준 예시는 다음과 같다.

- line-height가 font-size의 최소 1.5배
- 문단 뒤 간격이 font-size의 2배
- letter-spacing이 font-size의 0.12배
- word-spacing이 font-size의 0.16배

중요한 점은 “모든 디자인의 줄높이를 무조건 1.5로 하라”는 뜻이 아니라, 사용자가 가독성을 위해 간격을 바꿔도 UI가 깨지지 않아야 한다는 것이다.

Build us Care 적용 해석:

- 본문 line-height는 최소 1.55 이상을 기본으로 한다.
- 결제 안내, 환불 안내, 약관 체크 영역은 줄높이를 좁히지 않는다.
- 작은 캡션도 줄높이를 확보한다.
- 카드 높이를 고정해 텍스트가 잘리는 구조를 피한다.

출처:  
https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html

---

### 2.4 U.S. Web Design System

USWDS는 body copy를 포함한 대부분의 본문에 최소 effective 16px을 권장한다. 또한 line length, heading spacing, token 기반 설계를 강조한다.

Build us Care 적용 해석:

- 모바일 본문 16px은 최소값으로 둔다.
- 데스크톱 본문은 17px 또는 18px까지 허용한다.
- 제목 위 여백은 아래 여백보다 커야 한다.
- 텍스트 스타일은 token으로 관리한다.

출처:  
https://designsystem.digital.gov/components/typography/  
https://designsystem.digital.gov/design-tokens/typesetting/overview/

---

### 2.5 GOV.UK Design System

GOV.UK Design System은 type scale을 여러 기기에서 테스트하고 반복 개선했다고 설명한다. GOV.UK의 기본 body는 큰 화면에서 19px, 작은 화면에서 19px 또는 small body 16px 계열을 사용한다.

Build us Care 적용 해석:

- 본문을 14px로 낮추는 것은 위험하다.
- 공공 서비스처럼 명확해야 하는 결제/예약 안내에는 16px 이상이 안정적이다.
- 반응형에서 본문을 과도하게 줄이지 않는다.

출처:  
https://design-system.service.gov.uk/styles/type-scale/  
https://design-system.service.gov.uk/styles/paragraphs/

---

### 2.6 Shopify Polaris

Shopify Polaris는 heading과 body 두 종류의 type scale을 사용하고, line-height를 4px grid에 맞춰 UI 밀도와 일관성을 관리한다. 또한 통화/숫자는 mono 장식이 아니라 tabular numbers를 사용하라고 설명한다.

Build us Care 적용 해석:

- 가격 영역에는 `font-variant-numeric: tabular-nums;` 사용을 권장한다.
- 쇼핑몰/관리자/예약 목록처럼 숫자가 많은 곳은 숫자 폭이 흔들리지 않아야 한다.
- line-height는 22, 24, 26, 28, 30, 34, 40, 46, 64px처럼 2px/4px 리듬으로 맞춘다.

출처:  
https://polaris-react.shopify.com/design/typography  
https://polaris-react.shopify.com/design/typography/font-and-typescale

---

### 2.7 Baymard Institute

Baymard는 e-commerce UX 연구에서 본문 텍스트의 최적 줄 길이를 50~75자로 제시한다. 너무 긴 줄은 위압감을 주고, 너무 짧은 줄은 읽기 흐름을 끊는다.

Build us Care 적용 해석:

- 홈페이지 설명문 max-width: 560px
- 섹션 설명문 max-width: 640px
- 긴 안내문 max-width: 680px
- 제품 상세 설명은 전체 폭으로 늘리지 않는다.
- 결제/환불 안내는 좁고 읽기 쉬운 블록으로 배치한다.

출처:  
https://baymard.com/blog/line-length-readability

---

### 2.8 Nielsen Norman Group

NN/g는 가독성에서 “작은 글씨는 치명적”이라고 설명하며, 사용자가 읽을 수 있는 충분히 큰 기본 글자 크기를 사용하라고 말한다. 또한 e-commerce product page는 사용자가 구매 결정을 내리는 핵심 지점이며, 충분하고 명확한 제품 정보가 필요하다고 설명한다.

Build us Care 적용 해석:

- 제품명, 가격, 시공비, 옵션, CTA는 빠르게 훑어봐도 이해되어야 한다.
- 제품 카드 설명은 작게 숨기지 않는다.
- 결제 금액 구분이 흐리면 불신을 만든다.
- 제품 선택 페이지는 “정보를 덜 보여주는 디자인”이 아니라 “정보 우선순위를 잘 보여주는 디자인”이어야 한다.

출처:  
https://www.nngroup.com/articles/legibility-readability-comprehension/  
https://www.nngroup.com/articles/ecommerce-product-pages/

---

## 3. 전문가 방식의 타이포그래피 설계 원칙

### 3.1 역할 기반 토큰으로 만든다

전문가는 이렇게 하지 않는다.

```text
이 제목은 예쁘게 31px
이 설명은 대충 15px
이 버튼은 보기에 맞춰 14px
```

전문가는 이렇게 한다.

```text
hero
h1
h2
h3
cardTitle
bodyLarge
body
bodySmall
label
caption
button
priceMain
priceSub
```

Build us Care는 아래처럼 역할을 고정해야 한다.

| 역할 | 의미 | 예시 위치 |
|---|---|---|
| hero | 첫 화면 메인 문장 | 홈페이지 상단 |
| h1 | 페이지 대표 제목 | 견적 페이지 제목 |
| h2 | 섹션 제목 | 서비스 소개, 진행 과정 |
| h3 | 하위 제목 | 단계 제목, FAQ 그룹 |
| cardTitle | 카드 제목 | 변기 교체, 수전 교체 |
| bodyLarge | 리드 문장 | Hero 설명, 섹션 설명 |
| body | 일반 본문 | 안내문, 상세 설명 |
| bodySmall | 보조 설명 | 카드 설명, 부가 안내 |
| label | 라벨/태그 | 추천, 인기, 제품값 |
| caption | 캡션/주석 | 약관, 작은 안내 |
| button | CTA | 결제하기, 예약하기 |
| priceMain | 주 결제 금액 | 제품값 선결제 |
| priceSub | 보조 금액 | 시공비, 총액 |

---

### 3.2 폰트 크기보다 “크기 차이”가 중요하다

위계가 잘 보이는 사이트는 각 단계가 충분히 다르다.

좋은 위계:

```text
Hero 52
Section 36
Card 21
Body 17
Caption 12
```

나쁜 위계:

```text
Hero 40
Section 36
Card 24
Body 14
Caption 11
```

나쁜 위계는 제목끼리 서로 싸우고, 본문은 너무 작아진다.  
Build us Care는 “고급스럽지만 실용적인” 사이트여야 하므로 제목을 무작정 크게 키우지 말고, 본문을 작게 누르지 않아야 한다.

---

### 3.3 본문은 모바일 16px 아래로 내리지 않는다

권장값:

```text
Mobile body: 16px / 26px / 400
Desktop body: 17px / 28px / 400
```

Build us Care의 고객은 제품, 금액, 일정, 환불, 사진 안내를 읽어야 한다. 본문이 작으면 감도는 좋아 보일 수 있지만 실제 구매/예약 신뢰가 떨어진다.

---

### 3.4 줄높이는 제목과 본문을 다르게 잡는다

권장 범위:

| 유형 | line-height ratio |
|---|---:|
| Hero / Display | 1.15~1.25 |
| Section Title | 1.25~1.35 |
| Card Title | 1.35~1.45 |
| Body | 1.55~1.7 |
| Caption | 1.4~1.55 |
| Button | 1.2~1.35 |

Build us Care 권장 예시:

```text
Hero desktop: 52px / 64px
Hero mobile: 34px / 42px
Body desktop: 17px / 28px
Body mobile: 16px / 26px
Caption: 12px / 17px
```

---

### 3.5 폰트 굵기는 4단계만 쓴다

권장 굵기:

| 굵기 | 용도 |
|---:|---|
| 400 | 본문, 일반 설명 |
| 500 | 보조 강조, 안내 라벨 |
| 600 | 섹션 라벨, 네비게이션, 폼 라벨 |
| 700 | Hero, 제목, 카드 제목, CTA, 주요 가격 |

지양:

| 굵기 | 이유 |
|---:|---|
| 300 | 한국어에서 흐릿하고 약해 보임 |
| 800 | 과하게 강하고 전단지 느낌 |
| 900 | 생활 서비스보다 행사 배너 느낌 |

---

### 3.6 자간은 전체에 과하게 넣지 않는다

권장:

```text
Hero: -0.025em
H1/H2: -0.02em
Card title: -0.01em 또는 0
Body: 0
Caption: 0
Button: 0 또는 -0.01em
```

한국어는 자간을 너무 줄이면 뭉쳐 보인다. 특히 모바일에서 `letter-spacing: -0.05em` 같은 값은 피해야 한다.

---

### 3.7 가격 숫자는 tabular numbers를 쓴다

추천 CSS:

```css
.price,
.amount,
.numeric {
  font-variant-numeric: tabular-nums;
}
```

가격 숫자의 폭이 일정하면 제품 카드, 결제 요약, 관리자 페이지에서 정돈감이 올라간다.

---

## 4. Build us Care 최종 권장 Type Scale

### 4.1 모바일 기준

| Token | Size | Line-height | Weight | Letter spacing | 용도 |
|---|---:|---:|---:|---:|---|
| hero | 34px | 42px | 700 | -0.02em | 첫 화면 핵심 문장 |
| h1 | 32px | 40px | 700 | -0.02em | 페이지 대표 제목 |
| h2 | 26px | 34px | 700 | -0.015em | 섹션 제목 |
| h3 | 22px | 30px | 700 | -0.01em | 하위 제목 |
| cardTitle | 18px | 26px | 700 | -0.005em | 서비스/제품 카드 제목 |
| bodyLarge | 17px | 28px | 400 | 0 | Hero 설명, 섹션 리드 |
| body | 16px | 26px | 400 | 0 | 일반 본문 |
| bodySmall | 14px | 22px | 400 | 0 | 카드 설명, 보조 안내 |
| label | 13px | 18px | 600 | 0 | 라벨, 태그, 폼 라벨 |
| caption | 12px | 17px | 400/500 | 0 | 주석, 약관 보조문 |
| button | 16px | 20px | 700 | -0.005em | CTA 버튼 |
| priceMain | 28px | 36px | 700 | -0.015em | 오늘 결제 금액 |
| priceSub | 17px | 26px | 600 | 0 | 시공비, 총액 |
| nav | 14px | 20px | 600 | 0 | 메뉴 |

---

### 4.2 데스크톱 기준

| Token | Size | Line-height | Weight | Letter spacing | 용도 |
|---|---:|---:|---:|---:|---|
| hero | 52px | 64px | 700 | -0.025em | 첫 화면 핵심 문장 |
| h1 | 44px | 56px | 700 | -0.02em | 페이지 대표 제목 |
| h2 | 36px | 46px | 700 | -0.018em | 섹션 제목 |
| h3 | 28px | 38px | 700 | -0.012em | 하위 제목 |
| cardTitle | 21px | 30px | 700 | -0.005em | 카드 제목 |
| bodyLarge | 18px | 30px | 400 | 0 | 섹션 리드 |
| body | 17px | 28px | 400 | 0 | 일반 본문 |
| bodySmall | 15px | 24px | 400 | 0 | 보조 설명 |
| label | 13px | 18px | 600 | 0 | 라벨, 태그 |
| caption | 12px | 18px | 400/500 | 0 | 주석 |
| button | 16px | 20px | 700 | -0.005em | CTA 버튼 |
| priceMain | 32px | 40px | 700 | -0.015em | 오늘 결제 금액 |
| priceSub | 18px | 28px | 600 | 0 | 시공비, 총액 |
| nav | 14px | 20px | 600 | 0 | 메뉴 |

---

## 5. Build us Care 페이지별 적용 가이드

### 5.1 홈페이지 Hero

권장 구조:

```text
Eyebrow
사진 먼저 확인하는 생활 제품 교체 서비스

Hero
집 안의 작은 교체,
사진 3장으로 먼저 확인하세요.

Sub
변기, 수전, 환풍기, 조명처럼 작지만 번거로운 교체를
방문 견적 전에 사진으로 먼저 확인합니다.

CTA
교체 가능 여부 확인하기
```

적용:

| 요소 | Token |
|---|---|
| Eyebrow | label |
| Hero | hero |
| Sub | bodyLarge |
| CTA | button |

권장 max-width:

```text
Hero title: 720px
Hero sub: 560px
```

---

### 5.2 서비스 카드

예시:

```text
변기 교체
제품값은 온라인으로, 시공비는 현장에서 결제합니다.
```

적용:

| 요소 | Token |
|---|---|
| 카드 라벨 | label |
| 카드 제목 | cardTitle |
| 설명 | bodySmall |
| 시작가 | priceSub |
| 버튼 | button |

주의:

- 카드 제목을 16px로 만들지 않는다.
- 카드 설명을 13px 이하로 줄이지 않는다.
- 가격은 작게 숨기지 않는다.

---

### 5.3 진행 과정 섹션

예시:

```text
1. 사진 3장 보내기
교체할 제품과 주변 환경을 먼저 확인합니다.
```

적용:

| 요소 | Token |
|---|---|
| 번호 | label, 700 |
| 단계 제목 | cardTitle |
| 설명 | bodySmall 또는 body |

---

### 5.4 제품 선택/견적 페이지

제품 카드 권장 위계:

| 요소 | Mobile | Desktop |
|---|---:|---:|
| 제품명 | 18/26/700 | 21/30/700 |
| 브랜드/모델 | 13/18/600 | 13/18/600 |
| 제품 설명 | 14/22/400 | 15/24/400 |
| 제품값 | 22~24/30/700 | 24~26/34/700 |
| 시공비 | 15/22/500 | 16/24/500 |
| 총 예상 | 15/22/600 | 16/24/600 |
| 선택 버튼 | 16/20/700 | 16/20/700 |

금액 표기 예시:

```text
제품값 선결제
179,000원

시공비 현장결제
80,000원

예상 총액
259,000원
```

중요:

- Toss 결제 금액은 제품값만.
- 시공비는 현장 결제.
- 총액은 안내용.

UI 위계:

```text
가장 크게: 오늘 결제할 제품값
중간: 시공비 현장결제
작게: 예상 총액
```

---

### 5.5 결제 요약 영역

권장 위계:

| 요소 | Token |
|---|---|
| 섹션 제목 | h3 |
| 오늘 결제 라벨 | label |
| 오늘 결제 금액 | priceMain |
| 시공비 안내 | body |
| 총 예상 금액 | priceSub |
| 환불/주의 문구 | caption 또는 bodySmall |
| CTA | button |

좋은 예:

```text
오늘 결제할 금액
179,000원

시공비 80,000원은 설치 완료 후 현장에서 결제합니다.

[제품값 179,000원 결제하기]
```

나쁜 예:

```text
총 예상 금액 259,000원
제품값 179,000원
시공비 80,000원
```

나쁜 예는 사용자가 “그래서 지금 얼마 결제하지?”를 다시 생각하게 만든다.

---

### 5.6 폼 입력 영역

권장:

| 요소 | Size/Weight |
|---|---|
| 폼 라벨 | 14px / 600 |
| 입력값 | 16px / 400 |
| placeholder | 16px / 400 |
| helper text | 13px / 20px / 400 |
| error text | 13px / 20px / 600 |

주의:

- 모바일 input 텍스트는 16px 이상 권장.
- iOS에서 input이 16px보다 작으면 자동 확대가 발생할 수 있다.
- 오류 문구는 색상만 의존하지 말고 굵기/아이콘/문구로도 구분한다.

---

### 5.7 FAQ

권장:

| 요소 | Mobile | Desktop |
|---|---:|---:|
| 질문 | 16/24/600 | 17/26/600 |
| 답변 | 15/24/400 | 16/26/400 |

FAQ는 너무 작게 만들면 약관처럼 보인다.  
고객 불안을 줄이는 영역이므로 읽기 좋아야 한다.

---

### 5.8 관리자 페이지

Build us Care는 예약/결제/시공 상태 관리가 필요하므로 관리자 페이지도 타이포그래피가 중요하다.

권장:

| 요소 | Size/Weight |
|---|---|
| 페이지 제목 | 28~32px / 700 |
| 테이블 헤더 | 13px / 600 |
| 테이블 본문 | 14~15px / 400 |
| 상태 배지 | 12~13px / 600 |
| 금액 | 14~16px / 600, tabular-nums |
| 상세 섹션 제목 | 18~21px / 700 |

관리자 페이지는 감성보다 “오판 방지”가 중요하다. 숫자와 상태 배지는 정렬감이 필요하다.

---

## 6. 폰트 패밀리 추천

### 6.1 1순위: Pretendard

Build us Care에는 Pretendard가 가장 적합하다.

이유:

- 한국어 가독성이 좋다.
- SaaS/스타트업/라이프스타일 서비스 느낌이 있다.
- 너무 공공기관 같지 않다.
- 너무 패션 브랜드처럼 과장되지 않는다.
- 숫자와 UI 요소에도 잘 맞는다.

권장 CSS:

```css
body {
  font-family: Pretendard, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

### 6.2 2순위: SUIT

좀 더 부드럽고 라운드한 인상을 원하면 SUIT도 가능하다.  
다만 Build us Care의 결제/예약 UI에는 Pretendard가 더 안정적이다.

### 6.3 3순위: Noto Sans KR

가독성은 안정적이지만, 흔하고 일반적이며 공공기관/구형 웹 느낌이 날 수 있다.

---

## 7. 구현용 CSS 토큰

```css
:root {
  --font-sans: Pretendard, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --text-hero: 52px;
  --leading-hero: 64px;

  --text-h1: 44px;
  --leading-h1: 56px;

  --text-h2: 36px;
  --leading-h2: 46px;

  --text-h3: 28px;
  --leading-h3: 38px;

  --text-card-title: 21px;
  --leading-card-title: 30px;

  --text-body-lg: 18px;
  --leading-body-lg: 30px;

  --text-body: 17px;
  --leading-body: 28px;

  --text-body-sm: 15px;
  --leading-body-sm: 24px;

  --text-label: 13px;
  --leading-label: 18px;

  --text-caption: 12px;
  --leading-caption: 18px;

  --text-button: 16px;
  --leading-button: 20px;

  --text-price-main: 32px;
  --leading-price-main: 40px;

  --text-price-sub: 18px;
  --leading-price-sub: 28px;
}

@media (max-width: 767px) {
  :root {
    --text-hero: 34px;
    --leading-hero: 42px;

    --text-h1: 32px;
    --leading-h1: 40px;

    --text-h2: 26px;
    --leading-h2: 34px;

    --text-h3: 22px;
    --leading-h3: 30px;

    --text-card-title: 18px;
    --leading-card-title: 26px;

    --text-body-lg: 17px;
    --leading-body-lg: 28px;

    --text-body: 16px;
    --leading-body: 26px;

    --text-body-sm: 14px;
    --leading-body-sm: 22px;

    --text-label: 13px;
    --leading-label: 18px;

    --text-caption: 12px;
    --leading-caption: 17px;

    --text-price-main: 28px;
    --leading-price-main: 36px;

    --text-price-sub: 17px;
    --leading-price-sub: 26px;
  }
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  font-weight: 400;
  letter-spacing: 0;
}

.text-hero {
  font-size: var(--text-hero);
  line-height: var(--leading-hero);
  font-weight: 700;
  letter-spacing: -0.025em;
}

.text-h1 {
  font-size: var(--text-h1);
  line-height: var(--leading-h1);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.text-h2 {
  font-size: var(--text-h2);
  line-height: var(--leading-h2);
  font-weight: 700;
  letter-spacing: -0.018em;
}

.text-h3 {
  font-size: var(--text-h3);
  line-height: var(--leading-h3);
  font-weight: 700;
  letter-spacing: -0.012em;
}

.text-card-title {
  font-size: var(--text-card-title);
  line-height: var(--leading-card-title);
  font-weight: 700;
  letter-spacing: -0.005em;
}

.text-body-lg {
  font-size: var(--text-body-lg);
  line-height: var(--leading-body-lg);
  font-weight: 400;
}

.text-body {
  font-size: var(--text-body);
  line-height: var(--leading-body);
  font-weight: 400;
}

.text-body-sm {
  font-size: var(--text-body-sm);
  line-height: var(--leading-body-sm);
  font-weight: 400;
}

.text-label {
  font-size: var(--text-label);
  line-height: var(--leading-label);
  font-weight: 600;
}

.text-caption {
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-weight: 400;
}

.text-button {
  font-size: var(--text-button);
  line-height: var(--leading-button);
  font-weight: 700;
  letter-spacing: -0.005em;
}

.text-price-main {
  font-size: var(--text-price-main);
  line-height: var(--leading-price-main);
  font-weight: 700;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
}

.text-price-sub {
  font-size: var(--text-price-sub);
  line-height: var(--leading-price-sub);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
```

---

## 8. Tailwind 적용 예시

```text
Hero:
text-[34px] leading-[42px] font-bold tracking-[-0.02em]
md:text-[52px] md:leading-[64px] md:tracking-[-0.025em]

H1:
text-[32px] leading-[40px] font-bold tracking-[-0.02em]
md:text-[44px] md:leading-[56px]

H2:
text-[26px] leading-[34px] font-bold tracking-[-0.015em]
md:text-[36px] md:leading-[46px] md:tracking-[-0.018em]

H3:
text-[22px] leading-[30px] font-bold tracking-[-0.01em]
md:text-[28px] md:leading-[38px]

Card Title:
text-[18px] leading-[26px] font-bold
md:text-[21px] md:leading-[30px]

Body Large:
text-[17px] leading-[28px] font-normal
md:text-[18px] md:leading-[30px]

Body:
text-[16px] leading-[26px] font-normal
md:text-[17px] md:leading-[28px]

Body Small:
text-[14px] leading-[22px] font-normal
md:text-[15px] md:leading-[24px]

Label:
text-[13px] leading-[18px] font-semibold

Caption:
text-[12px] leading-[17px] font-normal
md:leading-[18px]

Button:
text-[16px] leading-[20px] font-bold tracking-[-0.005em]

Price Main:
text-[28px] leading-[36px] font-bold tracking-[-0.015em] tabular-nums
md:text-[32px] md:leading-[40px]

Price Sub:
text-[17px] leading-[26px] font-semibold tabular-nums
md:text-[18px] md:leading-[28px]
```

---

## 9. 하지 말아야 할 것

### 9.1 본문 14px 남발

```text
본문 14px
설명 13px
캡션 11px
```

이 조합은 깔끔해 보일 수 있지만, 실제로는 읽기 불편하고 신뢰가 떨어진다.

### 9.2 모든 제목을 크게 만들기

```text
Hero 48
Section 44
Card 28
```

모든 제목이 소리치면 아무것도 중요하지 않게 된다.

### 9.3 가격을 작게 숨기기

결제와 가격은 결정 정보다. 작게 숨기면 고객이 불안해진다.

### 9.4 자간 과도하게 줄이기

```css
letter-spacing: -0.05em;
```

한국어에서는 뭉침이 심하다. 큰 제목 외에는 0에 가깝게 둔다.

### 9.5 시공비와 제품값을 같은 위계로 보여주기

Build us Care는 제품값 온라인 결제, 시공비 현장 결제 구조다.  
오늘 결제 금액이 가장 커야 한다.

---

## 10. 디자인 QA 체크리스트

### 기본 가독성

- [ ] 모바일 본문이 16px 이상인가?
- [ ] 데스크톱 본문이 17px 이상인가?
- [ ] 카드 설명이 14px 아래로 떨어지지 않는가?
- [ ] 캡션이 12px 아래로 떨어지지 않는가?
- [ ] 본문 line-height가 1.55 이상인가?
- [ ] 제목 line-height가 너무 좁아 글자가 답답하지 않은가?

### 위계

- [ ] Hero > Section > Card > Body 순서가 명확한가?
- [ ] 카드 제목과 설명 크기 차이가 충분한가?
- [ ] 라벨과 본문이 뒤섞이지 않는가?
- [ ] CTA가 일반 텍스트보다 분명한가?

### 결제/가격

- [ ] 제품값 선결제가 가장 크게 보이는가?
- [ ] 시공비 현장결제가 보조 정보로 보이는가?
- [ ] 총 예상 금액이 결제 금액처럼 보이지 않는가?
- [ ] 가격 숫자에 tabular-nums가 적용되었는가?

### 레이아웃

- [ ] 설명문 max-width가 있는가?
- [ ] 긴 본문이 화면 전체 폭으로 늘어나지 않는가?
- [ ] 제목 위 여백이 아래 여백보다 충분한가?
- [ ] 모바일에서 줄바꿈이 자연스러운가?

### 접근성

- [ ] 텍스트 확대/줌 시 UI가 깨지지 않는가?
- [ ] 버튼 글자와 배경 대비가 충분한가?
- [ ] placeholder만으로 정보를 전달하지 않는가?
- [ ] 오류 문구가 작거나 색상만으로 구분되지 않는가?

---

## 11. Build us Care에 바로 적용할 최종 규칙

```text
폰트:
Pretendard

굵기:
400 / 500 / 600 / 700

모바일:
Hero 34/42/700
H1 32/40/700
H2 26/34/700
H3 22/30/700
Card 18/26/700
Body 16/26/400
Small 14/22/400
Caption 12/17/400
Button 16/20/700
Price Main 28/36/700

데스크톱:
Hero 52/64/700
H1 44/56/700
H2 36/46/700
H3 28/38/700
Card 21/30/700
Body 17/28/400
Small 15/24/400
Caption 12/18/400
Button 16/20/700
Price Main 32/40/700

본문 최대 너비:
Hero 설명 560px
섹션 설명 640px
긴 본문 680px

자간:
큰 제목만 -0.02em 전후
본문은 0

가격:
tabular-nums 적용
```

---

## 12. Codex 적용 프롬프트

아래 내용을 그대로 Codex에 전달하면 된다.

```text
Build us Care 홈페이지와 견적 페이지 전체의 typography system을 정리하고 적용해줘.

목표:
- 사이트 전체의 폰트 크기, 줄높이, 굵기, 자간을 일관된 token 기반으로 정리한다.
- 공사업체/수리업체 느낌이 아니라 프리미엄하고 트렌디한 생활 제품 교체 서비스처럼 보이게 한다.
- 모바일에서 읽기 쉽고, 데스크톱에서는 고급스럽게 보이게 한다.
- 모든 텍스트를 감으로 크기 지정하지 말고 역할 기반 typography token으로 정리한다.

기본 폰트:
- Pretendard를 기본 font-family로 사용한다.
- fallback은 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif로 둔다.
- 폰트 굵기는 400, 500, 600, 700만 사용한다.
- 300, 800, 900은 사용하지 않는다.

타이포그래피 토큰:

Mobile:
- hero: 34px / 42px / 700 / letter-spacing -0.02em
- h1: 32px / 40px / 700 / letter-spacing -0.02em
- h2: 26px / 34px / 700 / letter-spacing -0.015em
- h3: 22px / 30px / 700 / letter-spacing -0.01em
- cardTitle: 18px / 26px / 700
- bodyLarge: 17px / 28px / 400
- body: 16px / 26px / 400
- bodySmall: 14px / 22px / 400
- label: 13px / 18px / 600
- caption: 12px / 17px / 400 or 500
- button: 16px / 20px / 700
- priceMain: 28px / 36px / 700
- priceSub: 17px / 26px / 600

Desktop:
- hero: 52px / 64px / 700 / letter-spacing -0.025em
- h1: 44px / 56px / 700 / letter-spacing -0.02em
- h2: 36px / 46px / 700 / letter-spacing -0.018em
- h3: 28px / 38px / 700 / letter-spacing -0.012em
- cardTitle: 21px / 30px / 700
- bodyLarge: 18px / 30px / 400
- body: 17px / 28px / 400
- bodySmall: 15px / 24px / 400
- label: 13px / 18px / 600
- caption: 12px / 18px / 400 or 500
- button: 16px / 20px / 700
- priceMain: 32px / 40px / 700
- priceSub: 18px / 28px / 600

적용 방식:
1. 전역 CSS 또는 Tailwind config에 typography token을 먼저 정의해줘.
2. 기존 페이지에서 임의로 지정된 text size를 가능한 token 기반으로 교체해줘.
3. Hero 영역:
   - eyebrow는 label token
   - 메인 문장은 hero token
   - 설명문은 bodyLarge token
   - CTA는 button token
4. Section 영역:
   - 섹션 제목은 h2 token
   - 섹션 설명은 body 또는 bodyLarge token
5. Card 영역:
   - 카드 제목은 cardTitle token
   - 카드 설명은 bodySmall token
   - 카드 라벨은 label token
6. FAQ 영역:
   - 질문은 body 또는 16~17px semibold
   - 답변은 body/bodySmall token
7. 제품 선택 페이지:
   - 제품명은 cardTitle
   - 제품 설명은 bodySmall
   - 제품값은 priceMain 또는 22~26px bold
   - 시공비는 priceSub 또는 body semibold
   - 총 예상 금액은 body semibold
8. 결제 요약 영역:
   - 오늘 결제할 제품값이 가장 크게 보여야 한다.
   - 시공비 현장결제는 보조 정보로 보여준다.
   - 총 예상 금액은 참고 금액으로 보여준다.
   - Toss 결제 금액은 productAmount만 사용한다는 UI 구조를 유지한다.
9. 가격 숫자에는 tabular-nums 또는 font-variant-numeric: tabular-nums를 적용해줘.

줄 길이:
- Hero 설명문 max-width: 560px
- 일반 섹션 설명 max-width: 640px
- 긴 본문 max-width: 680px
- 데스크톱에서 본문이 화면 전체로 길게 늘어나지 않게 한다.

자간:
- 큰 제목만 -0.02em 정도 사용한다.
- 본문은 letter-spacing 0으로 둔다.
- 전체 텍스트에 과한 negative letter-spacing을 적용하지 않는다.

주의:
- 본문을 15px 이하로 작게 만들지 않는다. 모바일 본문은 기본 16px을 유지한다.
- 카드 제목과 본문 크기 차이가 분명해야 한다.
- 모든 제목을 너무 크게 만들지 않는다. Hero > Section > Card > Body 위계가 분명해야 한다.
- 가격 정보는 작게 숨기지 않는다.
- 공사업체 전단지처럼 과하게 굵고 큰 글자 남발을 피한다.
- 쇼핑몰처럼 작은 상품 카드 텍스트가 빽빽하게 보이지 않게 한다.
- 기존 기능, 결제, Supabase, Toss 연동 로직은 건드리지 않는다.
- 스타일 수정 후 typecheck와 build를 실행해줘.
```

---

## 13. 참고 자료

1. Material Design 3 Typography  
   https://m3.material.io/styles/typography/applying-type  
   https://m3.material.io/styles/typography/type-scale-tokens

2. Apple Human Interface Guidelines, Typography  
   https://developer.apple.com/design/human-interface-guidelines/typography

3. WCAG 2.2 Text Spacing  
   https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html

4. U.S. Web Design System, Typography  
   https://designsystem.digital.gov/components/typography/  
   https://designsystem.digital.gov/design-tokens/typesetting/overview/

5. GOV.UK Design System, Type Scale  
   https://design-system.service.gov.uk/styles/type-scale/  
   https://design-system.service.gov.uk/styles/paragraphs/

6. Shopify Polaris, Typography  
   https://polaris-react.shopify.com/design/typography  
   https://polaris-react.shopify.com/design/typography/font-and-typescale

7. Baymard Institute, Readability: The Optimal Line Length  
   https://baymard.com/blog/line-length-readability

8. Nielsen Norman Group, Legibility, Readability, and Comprehension  
   https://www.nngroup.com/articles/legibility-readability-comprehension/

9. Nielsen Norman Group, UX Guidelines for Ecommerce Product Pages  
   https://www.nngroup.com/articles/ecommerce-product-pages/
