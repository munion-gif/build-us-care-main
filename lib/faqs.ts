import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
};

export const DEFAULT_FAQS: FAQItem[] = [
  {
    id: "default-photo-check",
    question: "사진 확인은 왜 먼저 하나요?",
    answer: "설치 가능 여부와 필요한 부품, 방문 필요 여부가 집마다 달라서 먼저 사진으로 확인합니다. 가능한 경우에만 견적과 예약 안내로 이어가 불필요한 방문을 줄입니다.",
    category: "launch",
    display_order: 1,
    is_active: true
  },
  {
    id: "default-consult-cost",
    question: "사진 확인이나 상담 비용이 있나요?",
    answer: "사진 확인과 카톡 상담은 비용 없이 진행합니다. 방문이나 시공이 필요한 경우 견적을 먼저 안내하고, 고객이 확인한 뒤 예약 또는 결제로 이어집니다.",
    category: "launch",
    display_order: 2,
    is_active: true
  },
  {
    id: "default-kakao-consult",
    question: "카톡 상담은 어떻게 진행되나요?",
    answer: "사진 확인을 접수하면 접수번호가 생성됩니다. 카카오 채널에 접수번호를 보내주시면 상담원이 사진과 주소 정보를 확인해 견적 가능 여부를 이어서 안내합니다.",
    category: "launch",
    display_order: 3,
    is_active: true
  },
  {
    id: "default-standard-price",
    question: "정찰가로 바로 예약할 수 있는 작업은 무엇인가요?",
    answer: "제품과 작업 범위가 표준화된 교체·수리 항목은 서비스 페이지에서 금액을 확인하고 바로 예약할 수 있습니다. 현장 조건 확인이 필요한 작업은 사진 확인 후 상담으로 진행합니다.",
    category: "launch",
    display_order: 4,
    is_active: true
  },
  {
    id: "default-onsite-change",
    question: "현장에서 추가 비용이 생길 수 있나요?",
    answer: "사진이나 입력 정보와 다른 현장 조건, 추가 부품, 작업 범위 변경이 있으면 먼저 추가 비용과 사유를 안내합니다. 고객 동의 없이 임의로 진행하지 않습니다.",
    category: "launch",
    display_order: 5,
    is_active: true
  },
  {
    id: "default-after-order",
    question: "예약 변경, 취소, A/S는 어디서 하나요?",
    answer: "결제 후 받은 주문 현황 링크에서 예약 변경과 취소 요청을 할 수 있습니다. 시공 완료 후 보증 조건에 해당하는 A/S도 같은 링크에서 접수할 수 있습니다.",
    category: "launch",
    display_order: 6,
    is_active: true
  }
];

export async function getPublicFaqs(): Promise<FAQItem[]> {
  if (!hasSupabaseEnv()) return DEFAULT_FAQS;

  const { data, error } = await getSupabaseAdmin()
    .from("faqs")
    .select("id,question,answer,category,display_order,is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return DEFAULT_FAQS;
  return data.length > 0 ? data : DEFAULT_FAQS;
}

export async function getAdminFaqs(): Promise<FAQItem[]> {
  if (!hasSupabaseEnv()) return DEFAULT_FAQS;

  const { data, error } = await getSupabaseAdmin()
    .from("faqs")
    .select("id,question,answer,category,display_order,is_active")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return DEFAULT_FAQS;
  return data.length > 0 ? data : DEFAULT_FAQS;
}
