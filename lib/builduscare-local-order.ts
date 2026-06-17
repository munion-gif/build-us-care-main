"use client";

type StoredSelectedItem = {
  id?: string;
  brand?: string;
  name?: string;
  model?: string;
  image?: string;
  sku?: string;
  color?: string;
  selectedColor?: string;
  serviceCode?: string;
  categoryName?: string;
  qty?: number;
  price?: number;
};

type StoredBuilduscareOrder = {
  id?: string;
  orderNumber?: string;
  accessToken?: string;
  status?: string;
  localOnly?: boolean;
  customerName?: string;
  phone?: string;
  roadAddress?: string;
  detailAddress?: string;
  postalCode?: string;
  serviceName?: string;
  item?: string;
  selected?: StoredSelectedItem[];
  photoCount?: number;
  reservation?: { date?: string | null; time?: string | null; status?: string | null } | null;
  totals?: {
    productAmount?: number;
    laborAmount?: number;
    totalAmount?: number;
    onlinePaymentAmount?: number;
    onsitePaymentAmount?: number;
  } | null;
  payment?: {
    id?: string;
    status?: string;
    amount?: number;
    provider?: string;
    paid_at?: string | null;
    approved_at?: string | null;
    created_at?: string | null;
  } | null;
  cashReceipt?: { text?: string | null } | null;
  quote?: {
    id?: string;
    items?: any[];
    total_material?: number;
    total_labor?: number;
    total_final?: number;
  } | null;
  createdAt?: string;
};

const ORDER_RESULT_STORAGE_KEY = "builduscare:lastOrderResult";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function toArray<T>(value: T[] | T | null | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toDateText(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function slotToScheduledAt(date?: string | null, time?: string | null) {
  if (!date) return null;
  const hour = time === "afternoon" || time === "오후" ? "13:00:00" : "09:00:00";
  return `${date}T${hour}+09:00`;
}

export function readStoredBuilduscareOrder() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDER_RESULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBuilduscareOrder;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function matchesStoredBuilduscareOrder(params: { orderId?: string | null; accessToken?: string | null; orderNumber?: string | null }) {
  const stored = readStoredBuilduscareOrder();
  if (!stored) return null;

  const orderId = normalizeText(params.orderId);
  const accessToken = normalizeText(params.accessToken);
  const orderNumber = normalizeText(params.orderNumber).toUpperCase();

  const storedOrderId = normalizeText(stored.id);
  const storedAccessToken = normalizeText(stored.accessToken);
  const storedOrderNumber = normalizeText(stored.orderNumber).toUpperCase();

  if (orderId && storedOrderId && orderId !== storedOrderId) return null;
  if (accessToken && storedAccessToken && accessToken !== storedAccessToken) return null;
  if (orderNumber && storedOrderNumber && orderNumber !== storedOrderNumber) return null;

  return stored;
}

export function storedBuilduscareOrderToStatusOrder(stored: StoredBuilduscareOrder) {
  const selected = toArray(stored.selected);
  const reservationDate = toDateText(stored.reservation?.date ?? null);
  const reservationTime = normalizeText(stored.reservation?.time);
  const scheduledAt = slotToScheduledAt(reservationDate, reservationTime);
  const createdAt = stored.createdAt ?? new Date().toISOString();
  const serviceCode = normalizeText(selected[0]?.serviceCode) || "photo_inquiry";
  const productAmount = Number(stored.totals?.productAmount ?? stored.totals?.onlinePaymentAmount ?? 0);
  const laborAmount = Number(stored.totals?.laborAmount ?? stored.totals?.onsitePaymentAmount ?? 0);
  const totalAmount = Number(stored.totals?.totalAmount ?? productAmount + laborAmount);

  return {
    id: stored.id ?? `local-${Date.now().toString(36)}`,
    order_number: stored.orderNumber ?? "",
    status: stored.status ?? (selected.length > 0 ? "pending_product_payment" : "inquiry"),
    localOnly: stored.localOnly === true,
    created_at: createdAt,
    service_type_code: serviceCode,
    total_amount: totalAmount,
    online_payment_amount: Number(stored.totals?.onlinePaymentAmount ?? productAmount),
    onsite_payment_amount: Number(stored.totals?.onsitePaymentAmount ?? laborAmount),
    skus: selected.length > 0
      ? selected.map((item) => ({
          sku: item.serviceCode ?? item.sku ?? serviceCode,
          service_type_code: item.serviceCode ?? item.sku ?? serviceCode,
          item_name: item.name ?? item.model ?? item.id ?? "선택 제품",
          qty: Number(item.qty ?? 1)
        }))
      : [{
          sku: serviceCode,
          service_type_code: serviceCode,
          item_name: stored.item ?? stored.serviceName ?? "사진 확인",
          qty: 1
        }],
    home: {
      address_full: [stored.roadAddress, stored.detailAddress].filter(Boolean).join(" ") || stored.roadAddress || ""
    },
    quote: stored.quote
      ? {
          id: stored.quote.id ?? `local-quote-${Date.now().toString(36)}`,
          version: 1,
          total_final: Number(stored.quote.total_final ?? totalAmount),
          accepted_at: createdAt,
          items: Array.isArray(stored.quote.items)
            ? stored.quote.items
            : selected.map((item) => ({
                sku: item.serviceCode ?? item.sku ?? serviceCode,
                item_name: item.name ?? item.model ?? item.id ?? "선택 제품",
                qty: Number(item.qty ?? 1),
                unit_material: Number(item.price ?? 0),
                unit_labor: Number(selected.length > 0 ? laborAmount / Math.max(selected.length, 1) : laborAmount),
                line_total: Number(item.price ?? 0) * Number(item.qty ?? 1),
                metadata: {
                  selected_replacement_product: {
                    brand: item.brand ?? null,
                    model: item.model ?? item.name ?? null,
                    sku: item.sku ?? null,
                    price: Number(item.price ?? 0),
                    image: item.image ?? null
                  }
                }
              }))
        }
      : null,
    quotes: stored.quote
      ? [{
          id: stored.quote.id ?? `local-quote-${Date.now().toString(36)}`,
          version: 1,
          total_final: Number(stored.quote.total_final ?? totalAmount),
          accepted_at: createdAt,
          items: Array.isArray(stored.quote.items)
            ? stored.quote.items
            : selected.map((item) => ({
                sku: item.serviceCode ?? item.sku ?? serviceCode,
                item_name: item.name ?? item.model ?? item.id ?? "선택 제품",
                qty: Number(item.qty ?? 1),
                unit_material: Number(item.price ?? 0),
                unit_labor: Number(selected.length > 0 ? laborAmount / Math.max(selected.length, 1) : laborAmount),
                line_total: Number(item.price ?? 0) * Number(item.qty ?? 1),
                metadata: {
                  selected_replacement_product: {
                    brand: item.brand ?? null,
                    model: item.model ?? item.name ?? null,
                    sku: item.sku ?? null,
                    price: Number(item.price ?? 0),
                    image: item.image ?? null
                  }
                }
              }))
        }]
      : [],
    payments: stored.payment
      ? [{
          id: stored.payment.id ?? `local-payment-${Date.now().toString(36)}`,
          status: stored.payment.status ?? "pending",
          provider: stored.payment.provider ?? "bank_transfer",
          amount: Number(stored.payment.amount ?? productAmount),
          total_amount: totalAmount,
          online_payment_amount: Number(stored.totals?.onlinePaymentAmount ?? productAmount),
          onsite_payment_amount: Number(stored.totals?.onsitePaymentAmount ?? laborAmount),
          paid_at: stored.payment.paid_at ?? null,
          approved_at: stored.payment.approved_at ?? null,
          created_at: stored.payment.created_at ?? createdAt
        }]
      : [],
    jobs: scheduledAt
      ? [{
          id: `local-job-${Date.now().toString(36)}`,
          status: stored.status === "scheduled" ? "scheduled" : "assigned",
          scheduled_at: scheduledAt,
          created_at: createdAt,
          technicians: null
        }]
      : [],
    reservations: reservationDate
      ? [{
          id: `local-reservation-${Date.now().toString(36)}`,
          reserved_date: reservationDate,
          time_slot: reservationTime === "afternoon" || reservationTime === "오후" ? "afternoon" : "morning",
          status: stored.reservation?.status ?? "confirmed",
          created_at: createdAt
        }]
      : [],
    feedbacks: [],
    media: [],
    customer: {
      name: stored.customerName ?? "",
      phone: stored.phone ?? ""
    },
    cashReceipt: stored.cashReceipt ?? null
  };
}
