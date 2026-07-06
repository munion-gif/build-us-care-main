// 시공사례 데이터
// ⚠️ 미리보기용 예시 데이터입니다. 실제 서비스에서는 관리자에서 등록한 내용이
//    데이터베이스(Supabase)에서 불러와 이 자리를 채우게 됩니다.

export type CaseSection = {
  heading: string;
  text: string;
};

export type CaseItem = {
  slug: string;
  title: string;
  category: string; // 시공 항목 (예: 양변기, 수전)
  region: string; // 지역 (예: 강남구 대치동 ○○아파트)
  costTotal?: number; // 총 비용 (원, VAT 포함)
  costLabor?: number; // 공임비
  costProduct?: number; // 제품비
  durationMin?: number; // 시공 시간(분)
  date?: string; // 시공일 (YYYY-MM-DD)
  beforeImage?: string | null; // 시공 전 사진 URL (없으면 자리표시)
  afterImage?: string | null; // 시공 후 사진 URL
  summary: string; // 목록 카드용 한 줄 요약
  body: CaseSection[]; // 본문 섹션들
  highlights?: string[]; // 시공 후 장점 체크리스트
};

export const CASES: CaseItem[] = [
  {
    slug: "gangnam-yangbyungi-gyeoche",
    title: "강남구 대치동 아파트 양변기 교체",
    category: "양변기",
    region: "서울 강남구 대치동 ○○아파트",
    costTotal: 320000,
    costLabor: 90000,
    costProduct: 230000,
    durationMin: 60,
    date: "2026-06-28",
    beforeImage: null,
    afterImage: null,
    summary: "오래되어 물이 새던 변기를 절수형 원피스 변기로 교체했습니다.",
    body: [
      {
        heading: "이런 경우, 방치하면 안 돼요",
        text: "변기 아래쪽에서 물이 새거나 물 내림이 시원하지 않으면, 그대로 두면 바닥 누수·곰팡이·수도요금 증가로 이어집니다. 특히 20년 이상 된 변기는 내부 부속이 삭아 언제든 문제가 생길 수 있어요."
      },
      {
        heading: "[시공 전 상태]",
        text: "고객님은 물 내림이 약하고 변기 바닥 실리콘 틈에서 물이 배어 나온다고 하셨습니다. 현장에서 확인하니 배수 패킹이 노후해 미세 누수가 있었고, 변기 자체도 오래되어 교체를 권해 드렸습니다."
      },
      {
        heading: "[시공 후 모습]",
        text: "청소가 쉬운 원피스 절수형 변기로 교체하고, 바닥은 곰팡이에 강한 방수 실리콘으로 마감했습니다. 물 내림이 확실해졌고 누수 걱정이 사라졌습니다."
      }
    ],
    highlights: [
      "노후 변기 → 절수형 원피스 변기 교체",
      "배수 패킹·급수 호스 새 부품으로 교체",
      "바닥 방수 실리콘 재시공으로 누수 차단",
      "약 60분 만에 당일 완료"
    ]
  },
  {
    slug: "seocho-sedaesu-jeon-gyoche",
    title: "서초구 방배동 빌라 세면대 수전 교체",
    category: "수전",
    region: "서울 서초구 방배동 ○○빌라",
    costTotal: 180000,
    costLabor: 70000,
    costProduct: 110000,
    durationMin: 40,
    date: "2026-06-24",
    beforeImage: null,
    afterImage: null,
    summary: "물때가 끼고 물이 새던 세면대 수전을 깔끔한 신형으로 교체했습니다.",
    body: [
      {
        heading: "이런 경우, 방치하면 안 돼요",
        text: "수전 아래 연결부에서 물이 조금씩 새면 세면대 하부장이 젖어 곰팡이가 슬고, 물때가 낀 수전은 아무리 닦아도 깔끔해 보이지 않습니다."
      },
      {
        heading: "[시공 전 상태]",
        text: "레버가 뻑뻑하고 연결 호스에서 미세하게 물이 새던 상태였습니다. 하부장 안쪽에 물자국과 곰팡이 흔적이 있었어요."
      },
      {
        heading: "[시공 후 모습]",
        text: "물 흐름이 부드러운 신형 수전으로 교체하고, 연결 호스와 팝업(배수 마개)까지 새것으로 바꿔 누수를 잡았습니다."
      }
    ],
    highlights: [
      "노후 수전 → 신형 세면 수전 교체",
      "연결 호스·팝업 배수 부품 함께 교체",
      "하부장 곰팡이 흔적 정리",
      "약 40분 당일 완료"
    ]
  },
  {
    slug: "songpa-hwanpunggi-gyoche",
    title: "송파구 잠실 오피스텔 욕실 환풍기 교체",
    category: "환풍기",
    region: "서울 송파구 잠실동 ○○오피스텔",
    costTotal: 150000,
    costLabor: 80000,
    costProduct: 70000,
    durationMin: 50,
    date: "2026-06-20",
    beforeImage: null,
    afterImage: null,
    summary: "소음이 심하고 잘 안 돌던 욕실 환풍기를 저소음 제품으로 교체했습니다.",
    body: [
      {
        heading: "이런 경우, 방치하면 안 돼요",
        text: "환풍기가 약하면 욕실에 습기가 남아 곰팡이와 냄새의 원인이 됩니다. 소음이 커지는 건 모터가 노후했다는 신호예요."
      },
      {
        heading: "[시공 전 상태]",
        text: "작동은 되지만 소음이 크고 환기가 약한 상태였습니다. 천장 그릴에 먼지가 많이 껴 있었어요."
      },
      {
        heading: "[시공 후 모습]",
        text: "저소음·고효율 환풍기로 교체하니 소음이 확 줄고 환기가 확실해졌습니다. 습기 배출이 좋아져 곰팡이 걱정이 줄었어요."
      }
    ],
    highlights: [
      "노후 환풍기 → 저소음 고효율 제품 교체",
      "소음 크게 감소, 환기 성능 향상",
      "천장 배관·전원 점검 포함",
      "약 50분 당일 완료"
    ]
  },
  {
    slug: "mapo-silicone-jaesigong",
    title: "마포구 아파트 욕실 실리콘 재시공",
    category: "실리콘 재시공",
    region: "서울 마포구 ○○아파트",
    costTotal: 120000,
    costLabor: 100000,
    costProduct: 20000,
    durationMin: 90,
    date: "2026-06-15",
    beforeImage: null,
    afterImage: null,
    summary: "곰팡이가 낀 낡은 실리콘을 걷어내고 곰팡이에 강한 실리콘으로 재시공했습니다.",
    body: [
      {
        heading: "이런 경우, 방치하면 안 돼요",
        text: "실리콘에 검은 곰팡이가 끼면 아무리 닦아도 안 지워지고, 틈으로 물이 스며 벽 안쪽까지 상하게 만듭니다."
      },
      {
        heading: "[시공 전 상태]",
        text: "욕조·세면대·코너 실리콘에 검은 곰팡이가 넓게 퍼져 있었습니다. 일부는 들뜨고 갈라져 물이 새던 상태였어요."
      },
      {
        heading: "[시공 후 모습]",
        text: "기존 실리콘을 깨끗이 제거하고 곰팡이 방지 성분이 든 실리콘으로 얇고 균일하게 재시공했습니다. 욕실이 훨씬 깔끔해졌어요."
      }
    ],
    highlights: [
      "곰팡이 낀 기존 실리콘 완전 제거",
      "곰팡이 방지 실리콘으로 재시공",
      "욕조·세면대·코너 전체 마감",
      "약 90분 당일 완료"
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
  // 같은 항목 우선, 그다음 나머지
  const sameCategory = others.filter((c) => current && c.category === current.category);
  const rest = others.filter((c) => !current || c.category !== current.category);
  return [...sameCategory, ...rest].slice(0, limit);
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
