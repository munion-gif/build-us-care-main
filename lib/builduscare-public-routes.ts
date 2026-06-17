import type { ReplacementProductServiceCode } from "@/lib/replacement-products";

export type BuilduscareCategory = {
  slug: string;
  serviceCode: ReplacementProductServiceCode;
  title: string;
  english: string;
  itemLabel: string;
  description: string;
  image: string;
};

export const BUILDUSCARE_CATEGORIES: BuilduscareCategory[] = [
  {
    slug: "toilet",
    serviceCode: "toilet_replace",
    title: "양변기",
    english: "Toilet",
    itemLabel: "양변기 교체",
    description: "투피스, 원피스 양변기 교체 제품을 비교합니다.",
    image: "/assets/prod-toilet-1.png"
  },
  {
    slug: "washbasin",
    serviceCode: "basin_replace",
    title: "세면대",
    english: "Washbasin",
    itemLabel: "세면대 교체",
    description: "반다리, 긴다리 등 설치 조건에 맞는 세면대를 고릅니다.",
    image: "/assets/prod-washbasin-1.png"
  },
  {
    slug: "faucet",
    serviceCode: "faucet_replace",
    title: "수전",
    english: "Faucet",
    itemLabel: "수전 교체",
    description: "세면수전, 주방수전, 샤워욕조, 레인샤워를 한 번에 비교합니다.",
    image: "/assets/prod-faucet-1.png"
  },
  {
    slug: "bidet",
    serviceCode: "bidet_install",
    title: "비데 설치",
    english: "Bidet",
    itemLabel: "비데 설치",
    description: "전원과 급수 조건을 확인하고 비데 설치를 접수합니다.",
    image: "/assets/prod-bidet-1.png"
  },
  {
    slug: "ventilation",
    serviceCode: "ventilator_replace",
    title: "환풍기",
    english: "Ventilation",
    itemLabel: "환풍기 교체",
    description: "일반 환풍기와 복합 환풍기 제품을 구분해 봅니다.",
    image: "/assets/prod-vent-1.png"
  },
  {
    slug: "window-handle",
    serviceCode: "sash_handle",
    title: "샷시손잡이",
    english: "Window Handle",
    itemLabel: "샷시손잡이",
    description: "손잡이 사이즈와 색상을 확인하고 교체 가능 제품을 담습니다.",
    image: "/assets/prod-windowhandle-1.png"
  },
  {
    slug: "door-handle",
    serviceCode: "door_handle",
    title: "도어핸들",
    english: "Door Handle",
    itemLabel: "도어핸들",
    description: "문 두께와 잠금 타입에 맞는 도어핸들을 비교합니다.",
    image: "/assets/prod-doorhandle-1.png"
  },
  {
    slug: "silicone",
    serviceCode: "silicone_repair",
    title: "실리콘 재시공",
    english: "Silicone Reseal",
    itemLabel: "실리콘 재시공",
    description: "색상과 시공 길이를 기준으로 실리콘 재시공을 접수합니다.",
    image: "/assets/prod-silicone-1.png"
  },
  {
    slug: "bath-accessory",
    serviceCode: "bath_accessory",
    title: "욕실 악세서리",
    english: "Bath Accessory",
    itemLabel: "욕실 악세서리",
    description: "욕실 악세서리 세트와 선반, 수건걸이 단품을 비교합니다.",
    image: "/assets/prod-accessory-1.png"
  }
];

export function findBuilduscareCategory(slug: string) {
  return BUILDUSCARE_CATEGORIES.find((category) => category.slug === slug) ?? null;
}

export function findBuilduscareCategoryByService(serviceCode: string) {
  return BUILDUSCARE_CATEGORIES.find((category) => category.serviceCode === serviceCode) ?? null;
}
