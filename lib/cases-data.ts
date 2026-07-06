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
  durationMin?: number;
  date?: string; // YYYY-MM-DD
  cover?: string | null; // 목록 카드 대표 이미지 (없으면 본문 첫 사진 사용)
  summary: string; // 목록 카드용 한 줄 요약
  body: CaseBlock[]; // 글+사진 흐름
  highlights?: string[]; // 시공 후 장점 체크리스트
};

export const CASES: CaseItem[] = [
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
    summary: "청소가 힘들고 습기로 삭아 벌어진 하부장형 세면대를 발다리 일체형으로 교체해 화장실이 넓어 보이게 했습니다.",
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
        text: "기존 하부장형 세면대를 철거하고, 대림바스 CL-370 발다리 일체형 세면대로 당일 바로 교체했습니다."
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
      "PB 하부장형 세면대 → 대림바스 CL-370 발다리 일체형 세면대 교체",
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
