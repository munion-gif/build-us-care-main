export const PUBLIC_SERVICE_CODES = [
  "toilet_replace",
  "basin_replace",
  "faucet_replace",
  "bidet_install",
  "ventilator_replace",
  "sash_handle",
  "door_handle",
] as const;

export const PUBLIC_SERVICE_CODE_SET = new Set<string>(PUBLIC_SERVICE_CODES);

export const SERVICE_AREA_LABEL = "수원 · 성남(분당구) · 용인 · 의왕 · 군포 · 화성(동탄)";
export const SERVICE_AREA_NOTICE = `${SERVICE_AREA_LABEL} · 추후 확장 예정`;
