export const CUSTOMER_PHOTO_SLOTS = [
  {
    angle: "wide",
    label: "전체 컷",
    guide: "설치 위치와 주변이 같이 보이게",
    tags: ["customer", "wide"]
  },
  {
    angle: "close",
    label: "문제 부위",
    guide: "파손, 누수, 흔들림 부위를 가까이",
    tags: ["customer", "close"]
  },
  {
    angle: "context",
    label: "주변·규격",
    guide: "배관, 벽, 바닥, 제품 규격이 보이게",
    tags: ["customer", "context"]
  }
] as const;

export const JOB_PHOTO_GUIDES = [
  { key: "before", label: "시공 전", shortLabel: "전", guide: "전체 상태와 문제 부위", tags: ["job", "before"] },
  { key: "during", label: "작업 중", shortLabel: "중", guide: "철거, 보수, 설치 중 핵심 장면", tags: ["job", "during"] },
  { key: "after", label: "완료 후", shortLabel: "후", guide: "완료 전체 컷과 마감 부위", tags: ["job", "after"] },
  { key: "material", label: "자재", shortLabel: "자재", guide: "사용 자재, 박스, 영수증", tags: ["job", "material"] },
  { key: "issue", label: "이슈", shortLabel: "이슈", guide: "추가 비용, 파손, 현장 특이사항", tags: ["job", "issue"] }
] as const;

export function customerPhotoSlot(index: number) {
  return CUSTOMER_PHOTO_SLOTS[index] ?? CUSTOMER_PHOTO_SLOTS[CUSTOMER_PHOTO_SLOTS.length - 1];
}

export function jobPhotoGuide(type: string) {
  return JOB_PHOTO_GUIDES.find((item) => item.key === type) ?? JOB_PHOTO_GUIDES[0];
}
