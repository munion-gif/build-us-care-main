export const OPERATIONAL_ORDER_STATUSES = [
  "inquiry",
  "quoted",
  "payment_pending",
  "paid",
  "scheduled",
  "in_progress",
  "completed",
  "done",
  "issue",
  "warranty",
  "cancel_requested",
  "canceled"
] as const;

export const LEGACY_ORDER_STATUSES = [
  "submitted",
  "draft",
  "reservation_pending",
  "reservation_confirmed",
  "preparing",
  "in_service",
  "cancelled"
] as const;

export const DB_ORDER_STATUSES = [
  ...OPERATIONAL_ORDER_STATUSES,
  ...LEGACY_ORDER_STATUSES
] as const;

export type OperationalOrderStatus = (typeof OPERATIONAL_ORDER_STATUSES)[number];
export type LegacyOrderStatus = (typeof LEGACY_ORDER_STATUSES)[number];
export type DbOrderStatus = (typeof DB_ORDER_STATUSES)[number];
export type OrderStatus = DbOrderStatus;

export function normalizeOrderStatusAlias(status: string): OperationalOrderStatus | LegacyOrderStatus {
  if (status === "cancelled") return "canceled";
  return status as OperationalOrderStatus | LegacyOrderStatus;
}

export type ReservationStatus = "pending" | "confirmed" | "unavailable" | "cancelled";
export type ReservationTimeSlot = "morning" | "afternoon" | "all_day";
export type PaymentStatus = "ready" | "pending" | "done" | "failed" | "cancelled";

export type JobStatus =
  | "received"
  | "material_ready"
  | "assigned"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "supabase_not_configured"
  | "internal_error";

export type ServiceItem = {
  service_type_code: string;
  display_name: string;
  base_price: number;
  estimated_minutes: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
};

export type QuoteInputItem = {
  service_type_code?: string;
  product_id?: string;
  item_name: string;
  qty: number;
  unit_price: number;
  options?: Array<{
    name: string;
    price_delta: number;
  }>;
  metadata?: Record<string, unknown>;
};

export type QuoteLine = {
  product_id?: string;
  item_name: string;
  option_summary: string | null;
  qty: number;
  unit_price: number;
  option_total: number;
  line_total: number;
  metadata: Record<string, unknown> | null;
};

export type QuoteResult = {
  visit_fee: number;
  subtotal_amount: number;
  option_total: number;
  total_amount: number;
  items: QuoteLine[];
};
