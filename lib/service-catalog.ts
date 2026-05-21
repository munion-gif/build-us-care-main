export const CANONICAL_SERVICE_OPTIONS = [
  { code: "toilet_replace", label: "변기", displayName: "변기 교체" },
  { code: "faucet_replace", label: "수전", displayName: "수전 교체" },
  { code: "light_replace", label: "전등", displayName: "전등 교체" },
  { code: "outlet_replace", label: "콘센트", displayName: "콘센트 교체" },
  { code: "door_handle", label: "도어핸들", displayName: "도어핸들 교체" },
  { code: "bidet_install", label: "비데", displayName: "비데 설치" },
  { code: "ventilator_replace", label: "환풍기", displayName: "환풍기 교체" }
] as const;

export const CANONICAL_SERVICE_CODES = CANONICAL_SERVICE_OPTIONS.map((item) => item.code);

export const SERVICE_ALIASES: Record<string, string[]> = {
  faucet_replace: ["faucet_replace", "kitchen_faucet"],
  ventilator_replace: ["ventilator_replace", "bath_fan"]
};

export const SERVICE_NAME_BY_CODE: Record<string, string> = {
  toilet_replace: "변기 교체",
  faucet_replace: "수전 교체",
  kitchen_faucet: "수전 교체",
  light_replace: "전등 교체",
  outlet_replace: "콘센트 교체",
  door_handle: "도어핸들 교체",
  bidet_install: "비데 설치",
  ventilator_replace: "환풍기 교체",
  bath_fan: "환풍기 교체",
  drain_clog: "하수구 막힘",
  partial_wallpaper: "부분 도배"
};

export const SUPPORTED_SERVICE_CODES = new Set([
  ...CANONICAL_SERVICE_CODES,
  ...Object.values(SERVICE_ALIASES).flat()
]);

export function getServiceFilterCodes(code: string) {
  return SERVICE_ALIASES[code] ?? [code];
}

export function canonicalServiceCode(code?: string | null) {
  if (!code) return "";
  for (const [canonical, aliases] of Object.entries(SERVICE_ALIASES)) {
    if (aliases.includes(code)) return canonical;
  }
  return code;
}
