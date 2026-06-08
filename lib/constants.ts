import type { ServiceItem } from "@/lib/types";

export const DEFAULT_VISIT_FEE = 15000;
export const TOILET_REPLACE_LABOR_PRICE = 100000;
export const FAUCET_REPLACE_LABOR_PRICE = 40000;
export const SHOWER_BATH_FAUCET_LABOR_PRICE = 60000;
export const RAIN_SHOWER_FAUCET_LABOR_PRICE = 100000;
export const VENTILATOR_REPLACE_LABOR_PRICE = 60000;
export const VENTILATOR_COMPLEX_REPLACE_LABOR_PRICE = 80000;
export const BASIN_REPLACE_LABOR_PRICE = 80000;
export const BIDET_INSTALL_LABOR_PRICE = 60000;
export const SASH_HANDLE_REPLACE_LABOR_PRICE = 45000;
export const DOOR_HANDLE_REPLACE_LABOR_PRICE = 30000;
export const SILICONE_REPAIR_LABOR_PRICE = 6000;
export const BATH_ACCESSORY_SET_LABOR_PRICE = 50000;
export const BATH_ACCESSORY_ITEM_LABOR_PRICE = 25000;

export const SERVICE_BASE_LABOR_PRICES: Record<string, number> = {
  toilet_replace: TOILET_REPLACE_LABOR_PRICE,
  basin_replace: BASIN_REPLACE_LABOR_PRICE,
  faucet_replace: FAUCET_REPLACE_LABOR_PRICE,
  kitchen_faucet: FAUCET_REPLACE_LABOR_PRICE,
  bidet_install: BIDET_INSTALL_LABOR_PRICE,
  ventilator_replace: VENTILATOR_REPLACE_LABOR_PRICE,
  bath_fan: VENTILATOR_REPLACE_LABOR_PRICE,
  sash_handle: SASH_HANDLE_REPLACE_LABOR_PRICE,
  door_handle: DOOR_HANDLE_REPLACE_LABOR_PRICE,
  silicone_repair: SILICONE_REPAIR_LABOR_PRICE,
  bath_accessory: BATH_ACCESSORY_ITEM_LABOR_PRICE
};

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
    base_price: 40000,
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
    base_price: 30000,
    estimated_minutes: 30,
    metadata: { category: "door" }
  },
  {
    service_type_code: "silicone_repair",
    display_name: "실리콘 재시공",
    base_price: 6000,
    estimated_minutes: 90,
    metadata: { category: "bathroom" }
  },
  {
    service_type_code: "bath_accessory",
    display_name: "욕실 악세서리 설치",
    base_price: 25000,
    estimated_minutes: 45,
    metadata: { category: "bathroom" }
  },
  {
    service_type_code: "toilet_replace",
    display_name: "변기 교체",
    base_price: 100000,
    estimated_minutes: 120,
    metadata: { category: "bathroom" }
  },
  {
    service_type_code: "basin_replace",
    display_name: "세면대 교체",
    base_price: 80000,
    estimated_minutes: 120,
    metadata: { category: "bathroom" }
  },
  {
    service_type_code: "bath_fan",
    display_name: "욕실 환풍기 교체",
    base_price: 60000,
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
