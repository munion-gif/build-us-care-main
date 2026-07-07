// 시공사례 데이터
// ⚠️ 미리보기용 예시 데이터입니다. 실제 사례는 사진(public/cases/…)과 함께 이 자리를 채웁니다.
//
// 본문(body)은 "블록"의 순서 목록입니다. 글 블록과 사진 블록을 원하는 순서로 섞을 수 있어
// 홈코처럼 "설명 → 사진 → 설명 → 사진" 흐름을 자유롭게 만들 수 있습니다.
// 사진 개수는 사례마다 몇 장이든 상관없습니다.

export type CaseBlock =
  | { kind: "text"; heading?: string; text: string }
  | { kind: "photos"; label?: string; urls: (string | null)[] }; // url이 null이면 회색 자리표시(미리보기용)

export type CaseItem = {
  slug: string;
  title: string;
  category: string; // 시공 항목 (예: 양변기)
  region: string; // 지역
  costTotal?: number;
  costLabor?: number;
  costProduct?: number;
  costBreakdown?: { label: string; amount: number }[]; // 항목별 비용(제품 여러 개 등). 있으면 우선 표시
  durationMin?: number;
  date?: string; // YYYY-MM-DD
  cover?: string | null; // 목록 카드 대표 이미지 (없으면 본문 첫 사진 사용)
  summary: string; // 목록 카드용 한 줄 요약
  body: CaseBlock[]; // 글+사진 흐름
  highlights?: string[]; // 시공 후 장점 체크리스트
};

export const CASES: CaseItem[] = [
  {
    slug: "pangyo-hillstate-washbasin-set",
    title: "성남시 분당구 판교원마을 힐스테이트 세면대·수전 교체",
    category: "세면대·수전",
    region: "경기 성남시 분당구 판교원마을 힐스테이트",
    costTotal: 329000,
    costBreakdown: [
      { label: "세면대 제품가", amount: 141000 },
      { label: "세면수전 제품가", amount: 56000 },
      { label: "시공비 (세면대+수전)", amount: 132000 }
    ],
    durationMin: 40,
    date: "2026-07-05",
    cover: "/case-photos/pangyo-hillstate/after-1.jpg",
    summary: "깨진 곳을 메워 쓰던 낡은 세면대를, 인기 모델 세면대와 어울리는 수전까지 함께 교체해 새 욕실처럼 바꿨습니다.",
    body: [
      {
        kind: "text",
        heading: "이런 경우, 교체가 답이에요",
        text: "세면대가 깨진 곳을 메워서 쓰면 아무리 청소해도 그 틈으로 금방 때가 끼고, 욕실 전체가 낡고 오래돼 보입니다. 세면대를 바꾸는 김에 수전까지 함께 교체하면 분위기가 확 달라져요."
      },
      {
        kind: "text",
        heading: "시공 전 상태",
        text: "판교원마을 힐스테이트. 기존 세면대는 깨진 곳을 메워 그대로 사용 중이었고, 그 틈이 금방 더러워져 낡고 오래된 인상을 주고 있었습니다."
      },
      {
        kind: "photos",
        label: "시공 전",
        urls: ["/case-photos/pangyo-hillstate/before-1.jpg", "/case-photos/pangyo-hillstate/before-2.jpg"]
      },
      {
        kind: "text",
        heading: "시공 과정",
        text: "가장 인기 있는 심플한 대림바스 CL-370 반다리 일체형 세면대를 고르셨고, 세면대와 어울리는 같은 브랜드의 대림바스 DL-L2210 세면수전을 추천드려 함께 교체했습니다."
      },
      {
        kind: "photos",
        label: "시공 중",
        urls: ["/case-photos/pangyo-hillstate/during.jpg"]
      },
      {
        kind: "text",
        heading: "시공 후 모습",
        text: "낡은 세면대를 떼어내고 새 세면대와 수전으로 교체하니, 세면대 하나로 새 욕실처럼 분위기가 바뀌었다며 아주 만족하셨습니다."
      },
      {
        kind: "photos",
        label: "시공 완료",
        urls: [
          "/case-photos/pangyo-hillstate/after-1.jpg",
          "/case-photos/pangyo-hillstate/after-2.jpg",
          "/case-photos/pangyo-hillstate/after-3.jpg"
        ]
      }
    ],
    highlights: [
      "깨진 곳 메워 쓰던 낡은 세면대 → 대림바스 CL-370 반다리 일체형 세면대 교체",
      "세면대와 어울리는 대림바스 DL-L2210 세면수전 함께 교체",
      "세면대·수전 한 번에 바꿔 새 욕실처럼",
      "약 40분 만에 당일 완료"
    ]
  },
  {
    slug: "bundang-maehwa-washbasin-faucet",
    title: "성남시 분당구 매화마을2단지 세면수전 교체",
    category: "세면수전",
    region: "경기 성남시 분당구 매화마을2단지",
    costTotal: 102000,
    costLabor: 44000,
    costProduct: 58000,
    durationMin: 20,
    date: "2026-07-05",
    cover: "/case-photos/bundang-maehwa/after-1.jpg",
    summary: "도금이 다 벗겨진 검은색 세면수전을, 밝게 빛나는 크롬 수전으로 교체해 화장실 분위기를 환하게 바꿨습니다.",
    body: [
      {
        kind: "text",
        heading: "한 부분만 바꿔도 이렇게 달라져요",
        text: "수전 도금이 벗겨지기 시작하면 아무리 청소해도 원래대로 돌아오지 않고, 주변과 색이 안 맞으면 화장실 전체가 어두워 보입니다. 수전 하나만 바꿔도 분위기가 확 달라져요."
      },
      {
        kind: "text",
        heading: "시공 전 상태",
        text: "분당 매화마을2단지. 검은색 세면수전의 도금이 모두 벗겨져 청소로도 회복되지 않았고, 주변과 어울리지 않아 늘 고민이셨습니다."
      },
      {
        kind: "photos",
        label: "시공 전",
        urls: [
          "/case-photos/bundang-maehwa/before-1.jpg",
          "/case-photos/bundang-maehwa/before-2.jpg",
          "/case-photos/bundang-maehwa/before-3.jpg"
        ]
      },
      {
        kind: "text",
        heading: "시공 후 모습",
        text: "밝게 빛나는 크롬 세면수전(아메리칸스탠다드 CUBE-P)으로 교체했습니다. 검은색에서 크롬으로 바꾸니 화장실이 한결 밝아졌고, 수전 하나 교체로 분위기가 달라졌다며 좋아하셨습니다."
      },
      {
        kind: "photos",
        label: "시공 완료",
        urls: [
          "/case-photos/bundang-maehwa/after-1.jpg",
          "/case-photos/bundang-maehwa/after-2.jpg",
          "/case-photos/bundang-maehwa/after-3.jpg"
        ]
      }
    ],
    highlights: [
      "도금 벗겨진 검은색 세면수전 → 아메리칸스탠다드 CUBE-P 크롬 수전 교체",
      "크롬으로 바꿔 화장실이 한결 밝아짐",
      "수전 하나 교체로 분위기 전환",
      "약 20분 만에 당일 완료"
    ]
  },
  {
    slug: "dongtan-parkprugio-yangbyungi",
    title: "화성시 동탄 파크푸르지오 양변기 교체",
    category: "양변기",
    region: "경기 화성시 동탄 파크푸르지오",
    costTotal: 354000,
    costLabor: 110000,
    costProduct: 244000,
    durationMin: 60,
    date: "2026-07-04",
    cover: "/case-photos/dongtan-parkprugio/after-1.jpg",
    summary: "하부가 움푹 들어가 청소가 힘들고 커버가 황변된 낡은 변기를, 청소·관리 편한 치마형 변기로 교체했습니다.",
    body: [
      {
        kind: "text",
        heading: "이런 경우, 방치하면 안 돼요",
        text: "변기 하부가 움푹 들어간 형태면 구석구석 청소가 어렵고 때가 끼기 쉽습니다. 변기커버가 누렇게 황변되면 아무리 닦아도 낡아 보여요."
      },
      {
        kind: "text",
        heading: "시공 전 상태",
        text: "동탄 파크푸르지오. 기존 양변기는 하부가 움푹 들어간 형태라 청소가 힘들었고, 변기커버가 황변되어 오래되고 낡아 보였습니다."
      },
      {
        kind: "photos",
        label: "시공 전",
        urls: ["/case-photos/dongtan-parkprugio/before-1.jpg", "/case-photos/dongtan-parkprugio/before-2.jpg"]
      },
      {
        kind: "text",
        heading: "시공 과정",
        text: "고객님이 직접 아래쪽이 모두 막혀 청소·관리가 편한 심플한 치마형 변기(대림바스 CC-723 투피스)를 고르셔서, 바로 교체해 드렸습니다."
      },
      {
        kind: "photos",
        label: "시공 중",
        urls: ["/case-photos/dongtan-parkprugio/during-1.jpg", "/case-photos/dongtan-parkprugio/during-2.jpg"]
      },
      {
        kind: "text",
        heading: "시공 후 모습",
        text: "하부가 매끈하게 막힌 치마형이라 청소가 훨씬 쉬워졌습니다. 전보다 물 내려가는 속도가 빨라져 시원하게 내려가고, 조용한 댐퍼 시트에도 만족하셨습니다."
      },
      {
        kind: "photos",
        label: "시공 완료",
        urls: ["/case-photos/dongtan-parkprugio/after-1.jpg", "/case-photos/dongtan-parkprugio/after-2.jpg"]
      }
    ],
    highlights: [
      "하부 움푹·커버 황변된 낡은 변기 → 대림바스 CC-723 치마형 투피스 교체",
      "하부가 막힌 치마형이라 청소·관리가 쉬움",
      "물 내려가는 속도가 빨라져 시원한 세척",
      "천천히 닫히는 조용한 댐퍼 시트"
    ]
  },
  {
    slug: "gunpo-yulgok-faucets",
    title: "군포시 율곡주공아파트 주방·세면 수전 교체",
    category: "수전 2개",
    region: "경기 군포시 율곡주공아파트",
    costTotal: 264000,
    costBreakdown: [
      { label: "주방수전 제품가", amount: 120000 },
      { label: "세면수전 제품가", amount: 56000 },
      { label: "시공비 (수전 2개)", amount: 88000 }
    ],
    durationMin: 30,
    date: "2026-07-03",
    cover: "/case-photos/gunpo-yulgok/kitchen-after.jpg",
    summary: "낡은 주방수전과 세면수전을 한 번에 교체했습니다. 구축 아파트도 작은 교체 하나로 크게 달라집니다.",
    body: [
      {
        kind: "text",
        heading: "한 번에 두 곳, 수전 두 개를 교체했어요",
        text: "이 집은 주방수전과 세면수전을 한 번에 교체했습니다. 구축 아파트는 이렇게 작은 교체 하나로도 사용감과 분위기가 크게 달라져요."
      },
      {
        kind: "text",
        heading: "① 주방수전 · 시공 전",
        text: "기존 주방수전은 코팅이 벗겨지고 벽 고정부가 부식돼 떨어졌으며, 크기가 싱크대 주변 환경·높이와 맞지 않아 물이 많이 튀고 불편했습니다. 현재 상황에 설치 가능한 제품을 추천드려, 원하시는 제품으로 교체했습니다."
      },
      {
        kind: "photos",
        label: "주방수전 · 시공 전",
        urls: [
          "/case-photos/gunpo-yulgok/kitchen-before-1.jpg",
          "/case-photos/gunpo-yulgok/kitchen-before-2.jpg",
          "/case-photos/gunpo-yulgok/kitchen-before-3.jpg"
        ]
      },
      {
        kind: "photos",
        label: "시공 중",
        urls: ["/case-photos/gunpo-yulgok/during.jpg"]
      },
      {
        kind: "text",
        heading: "주방수전 · 시공 후",
        text: "낡은 수전이 사라지고 크기가 주변 환경과 맞아, 물 튀김 없이 편하게 쓸 수 있게 됐습니다."
      },
      {
        kind: "photos",
        label: "주방수전 · 시공 후",
        urls: ["/case-photos/gunpo-yulgok/kitchen-after.jpg"]
      },
      {
        kind: "text",
        heading: "② 세면수전 · 시공 전",
        text: "기존 세면수전도 코팅이 다 벗겨지고 안 지워지는 물때가 많았으며, 토수구가 짧아 부속품을 달아 쓰고 계셨습니다."
      },
      {
        kind: "photos",
        label: "세면수전 · 시공 전",
        urls: [
          "/case-photos/gunpo-yulgok/basin-before-1.jpg",
          "/case-photos/gunpo-yulgok/basin-before-2.jpg",
          "/case-photos/gunpo-yulgok/basin-before-3.jpg"
        ]
      },
      {
        kind: "text",
        heading: "세면수전 · 시공 후",
        text: "토수구가 길고 청소가 편한 심플한 디자인으로 교체했습니다. 구축 아파트도 작은 교체 하나로 이렇게 달라진다며 아주 만족하셨습니다."
      },
      {
        kind: "photos",
        label: "세면수전 · 시공 후",
        urls: ["/case-photos/gunpo-yulgok/basin-after.jpg"]
      }
    ],
    highlights: [
      "낡은 주방수전·세면수전 한 번에 교체",
      "주방: 주변 환경에 맞는 크기로 → 물 튀김 없이 편하게",
      "세면: 토수구 길고 청소 편한 심플 디자인으로",
      "구축 아파트도 작은 교체로 크게 개선"
    ]
  },
  {
    slug: "heungdeok-honorsville-kitchen-faucet",
    title: "용인시 기흥구 흥덕마을 경남아너스빌 주방수전 교체",
    category: "주방수전",
    region: "경기 용인시 기흥구 흥덕마을 경남아너스빌 13단지",
    costTotal: 109000,
    costLabor: 44000,
    costProduct: 65000,
    durationMin: 30,
    date: "2026-07-02",
    cover: "/case-photos/heungdeok-honorsville/after-1.jpg",
    summary: "높이가 낮고 물이 갈라져 나오던 주방수전을 높이 있는 신형으로 교체해, 허리 펴고 편하게 설거지하게 됐습니다.",
    body: [
      {
        kind: "text",
        heading: "한 부분만 바꿔도 이렇게 달라져요",
        text: "주방수전이 낮으면 설거지·요리할 때 허리를 굽혀야 해서 불편하고, 물줄기가 갈라져 나오면 물이 튀어 번거롭습니다. 수전 하나만 바꿔도 사용감과 주방 분위기가 확 달라져요."
      },
      {
        kind: "text",
        heading: "시공 전 상태",
        text: "흥덕마을 경남아너스빌. 싱크대와 수전 높이가 낮아 설거지·요리할 때 불편했고, 수전에서 물이 갈라져 나와 고객님이 교체를 원하셨습니다."
      },
      {
        kind: "photos",
        label: "시공 전",
        urls: ["/case-photos/heungdeok-honorsville/before-1.jpg", "/case-photos/heungdeok-honorsville/before-2.jpg"]
      },
      {
        kind: "text",
        heading: "시공 과정",
        text: "기존 낮은 주방수전을 철거하고, 대림바스 주방수전 DL-K2115SN으로 교체했습니다."
      },
      {
        kind: "photos",
        label: "시공 중",
        urls: ["/case-photos/heungdeok-honorsville/during.jpg"]
      },
      {
        kind: "text",
        heading: "시공 후 모습",
        text: "수전 높이가 높아져 허리를 펴고 편하게 설거지할 수 있게 됐고, 주방 분위기도 한결 산뜻해졌습니다. \"수전 하나로 이렇게 편해질 줄 몰랐다\"며 아주 만족하셨습니다."
      },
      {
        kind: "photos",
        label: "시공 완료",
        urls: [
          "/case-photos/heungdeok-honorsville/after-1.jpg",
          "/case-photos/heungdeok-honorsville/after-2.jpg",
          "/case-photos/heungdeok-honorsville/after-3.jpg"
        ]
      }
    ],
    highlights: [
      "낮고 물 갈라지던 주방수전 → 대림바스 DL-K2115SN 교체",
      "수전 높이가 높아져 허리 펴고 편하게 설거지",
      "수전 하나로 주방 분위기 개선",
      "약 30분 만에 당일 완료"
    ]
  },
  {
    slug: "uiwang-sinan-shower-faucet",
    title: "의왕시 신안아파트 샤워수전 교체",
    category: "수전",
    region: "경기 의왕시 신안아파트",
    costTotal: 264000,
    costLabor: 110000,
    costProduct: 154000,
    durationMin: 60,
    date: "2026-07-01",
    cover: "/case-photos/uiwang-sinan/after-1.jpg",
    summary: "욕조도 없는데 안 어울리던 금색 슬라이드바 샤워수전을, 서서 편하게 쓰는 레인샤워(해바라기)수전으로 교체했습니다.",
    body: [
      {
        kind: "text",
        heading: "한 부분만 바꿔도 이렇게 달라져요",
        text: "욕조가 없는 욕실에 욕조용 샤워수전(슬라이드바형)이 달려 있으면 서서 샤워하기 불편하고, 주변과 색이 안 맞으면 욕실 분위기도 어수선해 보입니다. 전체 공사 없이 수전 하나만 바꿔도 사용감과 분위기가 확 달라져요."
      },
      {
        kind: "text",
        heading: "시공 전 상태",
        text: "의왕 신안아파트. 욕조가 없는 욕실인데 욕조용 샤워수전과 슬라이드바가 달려 있었고, 주변과 어울리지 않는 금색이라 고객님이 교체를 원하셨습니다."
      },
      {
        kind: "photos",
        label: "시공 전",
        urls: ["/case-photos/uiwang-sinan/before.jpg"]
      },
      {
        kind: "text",
        heading: "시공 과정",
        text: "기존 금색 슬라이드바와 욕조용 샤워수전을 철거하고, 대림바스 레인샤워수전 BFB-720(해바라기형)으로 교체했습니다."
      },
      {
        kind: "photos",
        label: "시공 중",
        urls: ["/case-photos/uiwang-sinan/during.jpg"]
      },
      {
        kind: "text",
        heading: "시공 후 모습",
        text: "서서 편하게 샤워할 수 있는 레인샤워수전으로 바뀌었고, 욕실 분위기도 한결 깔끔해졌습니다. 예전부터 해바라기형 수전을 원하셨던 고객님이, 한 부분만 교체로 이렇게 바꿀 수 있다는 것에 아주 만족하셨습니다."
      },
      {
        kind: "photos",
        label: "시공 완료",
        urls: ["/case-photos/uiwang-sinan/after-1.jpg", "/case-photos/uiwang-sinan/after-2.jpg"]
      }
    ],
    highlights: [
      "안 어울리던 금색 슬라이드바 → 대림바스 레인샤워수전 BFB-720(해바라기형) 교체",
      "욕조 없는 욕실에 맞춰 서서 편하게 샤워",
      "수전 하나만 교체로 욕실 분위기 개선",
      "약 60분 만에 당일 완료"
    ]
  },
  {
    slug: "dongtan-kantabil-sedaedae",
    title: "화성시 동탄역 시범대원칸타빌 세면대 교체",
    category: "세면대",
    region: "경기 화성시 동탄 시범대원칸타빌",
    costTotal: 229000,
    costLabor: 88000,
    costProduct: 141000,
    durationMin: 40,
    date: "2026-06-30",
    cover: "/case-photos/dongtan-kantabil/after-1.jpg",
    summary: "청소가 힘들고 습기로 삭아 벌어진 하부장형 세면대를 반다리 일체형으로 교체해 화장실이 넓어 보이게 했습니다.",
    body: [
      {
        kind: "text",
        heading: "이런 경우, 방치하면 안 돼요",
        text: "세면대 아래 하부장(PB 소재)은 습기에 약해 시간이 지나면 삭고 벌어집니다. 하부장이 있으면 청소도 어렵고, 아래를 막아 화장실이 답답하고 좁아 보여요."
      },
      {
        kind: "text",
        heading: "시공 전 상태",
        text: "동탄역 시범대원칸타빌. 세면대 아래 PB 하부장이 습기로 삭아 벌어져 있었고, 그 때문에 청소가 힘든 상태였습니다. 하부장형 세면대라 화장실이 꽉 찬 느낌이라 답답해하셨어요."
      },
      {
        kind: "photos",
        label: "시공 전",
        urls: ["/case-photos/dongtan-kantabil/before.jpg"]
      },
      {
        kind: "text",
        heading: "시공 과정",
        text: "기존 하부장형 세면대를 철거하고, 대림바스 CL-370 반다리 일체형 세면대로 당일 바로 교체했습니다."
      },
      {
        kind: "photos",
        label: "시공 중",
        urls: ["/case-photos/dongtan-kantabil/during.jpg"]
      },
      {
        kind: "text",
        heading: "시공 후 모습",
        text: "막혀 있던 하부가 오픈되어 청소가 쉬워지고, 화장실이 한결 넓어 보이는 효과가 났습니다. 세면대 하나로 분위기가 바뀔지 반신반의하시던 고객님이 아주 만족하셨습니다."
      },
      {
        kind: "photos",
        label: "시공 완료",
        urls: ["/case-photos/dongtan-kantabil/after-1.jpg", "/case-photos/dongtan-kantabil/after-2.jpg"]
      }
    ],
    highlights: [
      "PB 하부장형 세면대 → 대림바스 CL-370 반다리 일체형 세면대 교체",
      "막혀 있던 하부가 오픈되어 청소가 쉬워짐",
      "공간이 트여 화장실이 넓어 보이는 효과",
      "약 40분 만에 당일 완료"
    ]
  },
  {
    slug: "naedaeji-gwangmyeong-yangbyungi",
    title: "용인시 수지구 내대지마을 광명샤인빌 양변기 교체",
    category: "양변기",
    region: "경기 용인시 수지구 내대지마을 광명샤인빌",
    costTotal: 356000,
    costLabor: 110000,
    costProduct: 246000,
    durationMin: 60,
    date: "2026-06-30",
    cover: "/case-photos/naedaeji-gwangmyeong/after.jpg",
    summary: "하부 백시멘트가 탈락돼 흔들리고 냄새가 역류하던 노후 변기를 대림바스 CC-724로 교체했습니다.",
    body: [
      {
        kind: "text",
        heading: "이런 경우, 방치하면 안 돼요",
        text: "양변기 하부를 고정하는 백시멘트가 삭아 탈락하면 변기가 흔들리고, 그 틈으로 하수 냄새가 역류합니다. 오래된 구축 아파트일수록 배수관까지 노후한 경우가 많아, 변기만 바꾸는 것으로는 냄새가 잡히지 않을 수 있어요."
      },
      {
        kind: "text",
        heading: "시공 전 상태",
        text: "내대지마을 광명샤인빌, 오래된 구축 아파트였습니다. 양변기 하부 백시멘트가 거의 다 탈락되어 변기가 흔들렸고, 그 틈으로 냄새가 역류하는 상태였습니다."
      },
      {
        kind: "photos",
        label: "시공 전",
        urls: ["/case-photos/naedaeji-gwangmyeong/before-1.jpg", "/case-photos/naedaeji-gwangmyeong/before-2.jpg"]
      },
      {
        kind: "text",
        heading: "시공 과정",
        text: "낡은 변기를 철거하고, 노후한 PVC 배수관까지 새것으로 추가·교체했습니다. 바닥 접합부를 꼼꼼히 다시 시공해 흔들림과 냄새 역류의 원인을 근본적으로 잡았습니다."
      },
      {
        kind: "photos",
        label: "시공 중",
        urls: ["/case-photos/naedaeji-gwangmyeong/during-1.jpg", "/case-photos/naedaeji-gwangmyeong/during-2.jpg"]
      },
      {
        kind: "text",
        heading: "시공 후 모습",
        text: "대림바스 CC-724 투피스 변기로 교체를 완료했습니다. 흔들림 없이 단단히 고정되고, 냄새 역류도 사라졌습니다."
      },
      {
        kind: "photos",
        label: "시공 완료",
        urls: ["/case-photos/naedaeji-gwangmyeong/after.jpg"]
      }
    ],
    highlights: [
      "노후 변기 → 대림바스 CC-724 투피스 교체",
      "탈락된 하부 백시멘트 재시공으로 흔들림 제거",
      "노후 PVC 배수관까지 교체해 냄새 역류 차단",
      "약 60분 만에 당일 완료"
    ]
  }
];

export function getAllCases(): CaseItem[] {
  return CASES;
}

export function getCaseBySlug(slug: string): CaseItem | undefined {
  return CASES.find((c) => c.slug === slug);
}

export function getRelatedCases(slug: string, limit = 3): CaseItem[] {
  const current = getCaseBySlug(slug);
  const others = CASES.filter((c) => c.slug !== slug);
  const sameCategory = others.filter((c) => current && c.category === current.category);
  const rest = others.filter((c) => !current || c.category !== current.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

// 목록 카드 대표 이미지: cover가 있으면 사용, 없으면 본문 첫 사진, 그것도 없으면 null
export function getCoverImage(item: CaseItem): string | null {
  if (item.cover) return item.cover;
  for (const block of item.body) {
    if (block.kind === "photos") {
      const firstReal = block.urls.find((u) => !!u);
      if (firstReal) return firstReal;
    }
  }
  return null;
}

export function formatWon(n?: number): string {
  if (n === undefined || n === null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

export function formatDuration(min?: number): string {
  if (!min) return "-";
  if (min < 60) return `약 ${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `약 ${h}시간 ${m}분` : `약 ${h}시간`;
}
