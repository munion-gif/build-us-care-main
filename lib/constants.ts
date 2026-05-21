import type { ServiceItem } from "@/lib/types";

export const DEFAULT_VISIT_FEE = 15000;

export const FALLBACK_SERVICE_ITEMS: ServiceItem[] = [
  {
    service_type_code: "bathroom_basic",
    display_name: "욕실 기본 점검/소모품 교체",
    base_price: 60000,
    estimated_minutes: 60,
    metadata: { category: "bathroom" }
  },
  {
    service_type_code: "kitchen_faucet",
    display_name: "주방 수전 교체",
    base_price: 90000,
    estimated_minutes: 90,
    metadata: { category: "kitchen" }
  },
  {
    service_type_code: "light_replace",
    display_name: "조명 교체",
    base_price: 40000,
    estimated_minutes: 40,
    metadata: { category: "lighting" }
  },
  {
    service_type_code: "door_handle",
    display_name: "도어 핸들 교체",
    base_price: 35000,
    estimated_minutes: 30,
    metadata: { category: "door" }
  },
  {
    service_type_code: "toilet_replace",
    display_name: "변기 교체",
    base_price: 80000,
    estimated_minutes: 120,
    metadata: { category: "bathroom" }
  },
  {
    service_type_code: "bath_fan",
    display_name: "욕실 환풍기 교체",
    base_price: 70000,
    estimated_minutes: 80,
    metadata: { category: "bathroom" }
  },
  {
    service_type_code: "slide_bar",
    display_name: "샤워 슬라이드바 교체",
    base_price: 45000,
    estimated_minutes: 45,
    metadata: { category: "bathroom" }
  },
  {
    service_type_code: "drain_replace",
    display_name: "욕실 유가 교체",
    base_price: 50000,
    estimated_minutes: 50,
    metadata: { category: "bathroom" }
  }
];
