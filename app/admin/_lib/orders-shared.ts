// 주문 응답(GET /api/admin/orders) 공용 타입/스테이지 매핑 — 새 관리자 화면 전용
export type AdminOrderRow = {
  id: string;
  order_number: string | null;
  status: string | null;
  total_amount: number | null;
  created_at: string | null;
  channel: string | null;
  service_type_code: string | null;
  skus: Array<{
    qty?: number;
    sku?: string;
    service_type_code?: string;
    metadata?: {
      service_type_code?: string;
      selected_replacement_product?: { brand?: string; model?: string; name?: string } | null;
      [key: string]: unknown;
    };
  }> | null;
  deleted_at: string | null;
  is_test: boolean | null;
  customers: { id?: string; name?: string | null; phone?: string | null } | null;
  homes: { address_full?: string | null } | null;
  quotes: Array<{ id: string; version?: number; total_final?: number; created_at?: string; accepted_at?: string | null }> | null;
  payments: Array<{ id?: string; amount?: number; method?: string; status?: string; paid_at?: string | null; created_at?: string }> | null;
  jobs:
    | { id: string; status?: string | null; technician_id?: string | null; scheduled_at?: string | null; technicians?: { id?: string; name?: string | null } | null }
    | Array<{ id: string; status?: string | null; technician_id?: string | null; scheduled_at?: string | null; technicians?: { id?: string; name?: string | null } | null }>
    | null;
  cancellations: Array<{ id?: string; status?: string | null; created_at?: string }> | null;
};

export type Stage = "quote" | "pay" | "assign" | "booked" | "done" | "cancel";

export function orderJob(order: AdminOrderRow) {
  const jobs = order.jobs;
  if (!jobs) return null;
  return Array.isArray(jobs) ? (jobs[0] ?? null) : jobs;
}

export function orderStage(order: AdminOrderRow): Stage {
  const s = (order.status ?? "").toLowerCase();
  if (["cancel_requested", "canceled", "cancelled", "refunded", "warranty", "issue"].includes(s)) return "cancel";
  if (["completed", "done", "installation_completed"].includes(s)) return "done";
  if (["in_progress", "in_service", "inprogress", "scheduled", "reservation_confirmed", "preparing"].includes(s)) return "booked";
  if (["payment_pending", "reservation_pending", "pending_product_payment"].includes(s)) return "pay";
  if (["paid", "product_paid"].includes(s)) {
    const job = orderJob(order);
    return job?.technician_id ? "booked" : "assign";
  }
  // inquiry / draft / submitted / quoted
  return "quote";
}

export const STAGE_META: Record<Stage, { pill: string; label: string; next: string }> = {
  quote: { pill: "p-new", label: "견적·결제 대기", next: "견적 확인" },
  pay: { pill: "p-pay", label: "입금 대기", next: "입금 확인" },
  assign: { pill: "p-assign", label: "배정 필요", next: "기사 배정" },
  booked: { pill: "p-booked", label: "예약 확정", next: "완료 처리" },
  done: { pill: "p-done", label: "완료", next: "—" },
  cancel: { pill: "p-cancel", label: "취소·A/S", next: "취소 처리" }
};

export function stageLabel(order: AdminOrderRow): string {
  const s = (order.status ?? "").toLowerCase();
  if (s === "in_progress" || s === "in_service" || s === "inprogress") return "시공 중";
  if (s === "warranty") return "A/S 접수";
  if (s === "issue") return "문제 확인";
  if (s === "cancel_requested") return "취소 요청";
  if (s === "canceled" || s === "cancelled") return "취소됨";
  if (s === "refunded") return "환불 완료";
  if (s === "quoted") return "견적 발송됨";
  if (s === "inquiry" || s === "draft" || s === "submitted") return "문의 접수";
  return STAGE_META[orderStage(order)].label;
}

export function orderItemsSummary(order: AdminOrderRow): string {
  const skus = order.skus ?? [];
  const names = skus
    .map((it) => {
      const p = it?.metadata?.selected_replacement_product;
      const nm = [p?.brand, p?.model ?? p?.name].filter(Boolean).join(" ");
      return nm || null;
    })
    .filter(Boolean) as string[];
  if (names.length > 0) return names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : names[0];
  return serviceLabel(order.service_type_code);
}

const SERVICE_LABELS: Record<string, string> = {
  toilet_replace: "양변기 교체",
  basin_replace: "세면대 교체",
  faucet_replace: "수전 교체",
  bidet_install: "비데 설치",
  ventilator_replace: "환풍기 교체",
  sash_handle: "샷시손잡이 교체",
  door_handle: "도어핸들 교체",
  silicone_repair: "실리콘 재시공",
  bath_accessory: "욕실 액세서리"
};

export function serviceLabel(code?: string | null): string {
  if (!code) return "제품 교체";
  return SERVICE_LABELS[code] ?? code;
}

export function shortRegion(address?: string | null): string {
  if (!address) return "—";
  const parts = address.split(/\s+/);
  return parts.slice(0, 3).join(" ") || address;
}
