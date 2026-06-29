export const BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE = "builduscare_local_admin_order";
export const BUILDUSCARE_LOCAL_ADMIN_DIAGNOSIS_COOKIE = "builduscare_local_admin_diagnosis";
export const BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE = "builduscare_local_admin_orders";
export const BUILDUSCARE_LOCAL_ADMIN_DIAGNOSES_COOKIE = "builduscare_local_admin_diagnoses";
export const BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const BUILDUSCARE_LOCAL_ADMIN_HISTORY_LIMIT = 10;

type LocalSelectedItem = {
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

export type LocalAdminOrderCookie = {
  id: string;
  orderNumber: string;
  accessToken?: string;
  status: string;
  customerName: string;
  phone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode?: string;
  item: string;
  requestType: "product_order" | "photo_check";
  selected: LocalSelectedItem[];
  photoCount: number;
  reservation?: {
    date?: string | null;
    time?: string | null;
  } | null;
  totals?: {
    productAmount?: number;
    laborAmount?: number;
    shippingAmount?: number;
    disposalAmount?: number;
    totalAmount?: number;
    onlinePaymentAmount?: number;
    onsitePaymentAmount?: number;
  } | null;
  payment?: {
    id?: string;
    status?: string;
    amount?: number;
    provider?: string;
  } | null;
  cashReceipt?: {
    type?: string;
    identity?: string;
    text?: string;
  } | null;
  quote?: {
    id?: string;
    version?: number;
    items?: any[];
    total_material?: number;
    total_labor?: number;
    total_final?: number;
    visit_fee?: number;
    discount?: number;
    accepted_at?: string;
    created_at?: string;
  } | null;
  visitFee?: number;
  discount?: number;
  localOnly: true;
  createdAt: string;
};

export type LocalAdminDiagnosisCookie = {
  id: string;
  orderId: string;
  orderNumber: string;
  serviceTypeCode: string;
  item: string;
  customerName: string;
  customerPhone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode?: string;
  photoCount: number;
  result?: string | null;
  reason?: string | null;
  createdAt: string;
  localOnly: true;
};

export type LocalAdminOrderHistoryEntry = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  phone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode?: string;
  item: string;
  serviceTypeCode: string;
  requestType: "product_order";
  productSummary: string;
  photoCount: number;
  reservation?: {
    date?: string | null;
    time?: string | null;
  } | null;
  totals?: {
    productAmount?: number;
    laborAmount?: number;
    totalAmount?: number;
    onlinePaymentAmount?: number;
    onsitePaymentAmount?: number;
  } | null;
  payment?: {
    status?: string;
    amount?: number;
    provider?: string;
  } | null;
  cashReceiptText?: string;
  quote?: {
    id?: string;
    version?: number;
    items?: any[];
    total_material?: number;
    total_labor?: number;
    total_final?: number;
    visit_fee?: number;
    discount?: number;
    accepted_at?: string;
    created_at?: string;
  } | null;
  visitFee?: number;
  discount?: number;
  createdAt: string;
};

export type LocalAdminDiagnosisHistoryEntry = {
  id: string;
  orderId: string;
  orderNumber: string;
  serviceTypeCode: string;
  item: string;
  customerName: string;
  customerPhone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode?: string;
  photoCount: number;
  result?: string | null;
  reason?: string | null;
  createdAt: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function selectedItemQuoteLines(selected: LocalSelectedItem[]) {
  return selected.map((item) => {
    const qty = Math.max(1, Number(item.qty ?? 1));
    const unitMaterial = Number(item.price ?? 0);
    return {
      sku: item.serviceCode ?? item.sku ?? "photo_inquiry",
      service_type_code: item.serviceCode ?? item.sku ?? "photo_inquiry",
      item_name: [item.brand, item.model ?? item.name].filter(Boolean).join(" ").trim() || item.name || item.model || item.id || "선택 제품",
      qty,
      unit_material: unitMaterial,
      unit_labor: 0,
      line_material: unitMaterial * qty,
      line_labor: 0,
      line_total: unitMaterial * qty,
      metadata: {
        service_type_code: item.serviceCode ?? item.sku ?? "photo_inquiry",
        selected_replacement_product_snapshot: {
          brand: item.brand ?? null,
          model: item.model ?? item.name ?? null,
          sku: item.sku ?? null,
          image: item.image ?? null,
          price: unitMaterial
        }
      }
    };
  });
}

function safeJsonParse<T>(value?: string | null) {
  if (!value) return null;
  const candidates = [value];
  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) candidates.push(decoded);
  } catch {
    // ignore malformed escape sequences and fall back to the raw cookie value
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function readLocalAdminOrderCookie(value?: string | null) {
  const parsed = safeJsonParse<LocalAdminOrderCookie>(value);
  if (!parsed?.id || !parsed?.orderNumber) return null;
  return parsed;
}

export function readLocalAdminDiagnosisCookie(value?: string | null) {
  const parsed = safeJsonParse<LocalAdminDiagnosisCookie>(value);
  if (!parsed?.id || !parsed?.orderNumber) return null;
  return parsed;
}

export function readLocalAdminOrderHistoryCookie(value?: string | null) {
  const parsed = safeJsonParse<LocalAdminOrderHistoryEntry[]>(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => item?.id && item?.orderNumber);
}

export function readLocalAdminDiagnosisHistoryCookie(value?: string | null) {
  const parsed = safeJsonParse<LocalAdminDiagnosisHistoryEntry[]>(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => item?.id && item?.orderNumber);
}

export function appendLocalAdminOrderHistory(history: LocalAdminOrderHistoryEntry[], next: LocalAdminOrderHistoryEntry) {
  return [next, ...history.filter((item) => item.id !== next.id)].slice(0, BUILDUSCARE_LOCAL_ADMIN_HISTORY_LIMIT);
}

export function appendLocalAdminDiagnosisHistory(history: LocalAdminDiagnosisHistoryEntry[], next: LocalAdminDiagnosisHistoryEntry) {
  return [next, ...history.filter((item) => item.id !== next.id)].slice(0, BUILDUSCARE_LOCAL_ADMIN_HISTORY_LIMIT);
}

export function localAdminOrderToAdminListItem(stored: LocalAdminOrderCookie) {
  const selected = Array.isArray(stored.selected) ? stored.selected : [];
  const firstServiceCode = normalizeText(selected[0]?.serviceCode) || "photo_inquiry";
  const productAmount = Number(stored.totals?.productAmount ?? stored.totals?.onlinePaymentAmount ?? 0);
  const laborAmount = Number(stored.totals?.laborAmount ?? stored.totals?.onsitePaymentAmount ?? 0);
  const totalAmount = Number(stored.totals?.totalAmount ?? productAmount + laborAmount);
  const storedQuoteItems = Array.isArray(stored.quote?.items) ? stored.quote.items : [];
  const quoteItems = storedQuoteItems.length > 0 ? storedQuoteItems : selectedItemQuoteLines(selected);

  return {
    id: stored.id,
    order_number: stored.orderNumber,
    status: stored.status,
    total_amount: totalAmount,
    created_at: stored.createdAt,
    channel: "builduscare_web",
    source: stored.requestType === "photo_check" ? "builduscare_photo_check" : "builduscare_web",
    service_type_code: firstServiceCode,
    reason: stored.requestType === "photo_check" ? "photo_check_request" : "product_order_request",
    skus: selected.length > 0
      ? selected.map((item) => ({
          sku: item.serviceCode ?? item.sku ?? firstServiceCode,
          service_type_code: item.serviceCode ?? item.sku ?? firstServiceCode,
          item_name: item.name ?? item.model ?? item.id ?? stored.item,
          qty: Number(item.qty ?? 1),
          metadata: {
            service_type_code: item.serviceCode ?? item.sku ?? firstServiceCode,
            selected_replacement_product_snapshot: {
              brand: item.brand ?? null,
              model: item.model ?? item.name ?? null,
              sku: item.sku ?? null,
              image: item.image ?? null,
              price: Number(item.price ?? 0)
            }
          }
        }))
      : [{
          sku: firstServiceCode,
          service_type_code: firstServiceCode,
          item_name: stored.item,
          qty: 1,
          metadata: { service_type_code: firstServiceCode, inquiry_only: true, request_type: "photo_check" }
        }],
    special_requests: stored.cashReceipt?.text ? `현금영수증: ${stored.cashReceipt.text}` : "",
    inquiry_photos: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
    customers: {
      name: stored.customerName,
      phone: stored.phone,
      address_full: stored.roadAddress,
      address_apt: stored.detailAddress,
      acquisition_source: "builduscare_web"
    },
    homes: {
      address_full: stored.roadAddress,
      address_apt: stored.detailAddress,
      postal_code: stored.postalCode ?? null
    },
    payments: stored.payment ? [{
      id: stored.payment.id ?? `local-payment-${stored.id}`,
      status: stored.payment.status ?? "pending",
      amount: Number(stored.payment.amount ?? productAmount),
      provider: stored.payment.provider ?? "bank_transfer",
      online_payment_amount: Number(stored.totals?.onlinePaymentAmount ?? productAmount),
      onsite_payment_amount: Number(stored.totals?.onsitePaymentAmount ?? laborAmount),
      total_amount: totalAmount,
      created_at: stored.createdAt
    }] : [],
    quotes: stored.quote ? [{
      id: stored.quote.id ?? `local-quote-${stored.id}`,
      version: Number(stored.quote.version ?? 1),
      items: quoteItems,
      total_material: Number(stored.quote.total_material ?? productAmount),
      total_labor: Number(stored.quote.total_labor ?? laborAmount),
      total_final: Number(stored.quote.total_final ?? totalAmount),
      accepted_at: stored.quote.accepted_at ?? stored.createdAt,
      created_at: stored.quote.created_at ?? stored.createdAt
    }] : [],
    media: [],
    jobs: stored.reservation?.date ? [{
      id: `local-job-${stored.id}`,
      technician_id: null,
      assigned_technician_name: null,
      scheduled_at: `${stored.reservation.date}T${stored.reservation.time === "afternoon" || stored.reservation.time === "오후" ? "13:00:00" : "09:00:00"}+09:00`,
      status: stored.status === "scheduled" ? "scheduled" : "assigned",
      technicians: null
    }] : [],
    cancellations: [],
    is_test: false,
    test_note: null,
    deleted_at: null,
    deleted_reason: null,
    visit_fee: Number(stored.visitFee ?? stored.quote?.visit_fee ?? 0),
    localOnly: true
  };
}

export function localAdminOrderHistoryToAdminListItem(stored: LocalAdminOrderHistoryEntry) {
  const productAmount = Number(stored.totals?.productAmount ?? stored.totals?.onlinePaymentAmount ?? 0);
  const laborAmount = Number(stored.totals?.laborAmount ?? stored.totals?.onsitePaymentAmount ?? 0);
  const totalAmount = Number(stored.totals?.totalAmount ?? productAmount + laborAmount);

  return {
    id: stored.id,
    order_number: stored.orderNumber,
    status: stored.status,
    total_amount: totalAmount,
    created_at: stored.createdAt,
    channel: "builduscare_web",
    source: "builduscare_web",
    service_type_code: stored.serviceTypeCode,
    reason: "product_order_request",
    skus: [{
      sku: stored.serviceTypeCode,
      service_type_code: stored.serviceTypeCode,
      item_name: stored.productSummary || stored.item,
      qty: 1,
      metadata: { service_type_code: stored.serviceTypeCode }
    }],
    special_requests: stored.cashReceiptText ? `현금영수증: ${stored.cashReceiptText}` : "",
    inquiry_photos: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
    customers: {
      name: stored.customerName,
      phone: stored.phone,
      address_full: stored.roadAddress,
      address_apt: stored.detailAddress,
      acquisition_source: "builduscare_web"
    },
    homes: {
      address_full: stored.roadAddress,
      address_apt: stored.detailAddress,
      postal_code: stored.postalCode ?? null
    },
    payments: stored.payment ? [{
      id: `local-payment-${stored.id}`,
      status: stored.payment.status ?? "pending",
      amount: Number(stored.payment.amount ?? productAmount),
      provider: stored.payment.provider ?? "bank_transfer",
      online_payment_amount: Number(stored.totals?.onlinePaymentAmount ?? productAmount),
      onsite_payment_amount: Number(stored.totals?.onsitePaymentAmount ?? laborAmount),
      total_amount: totalAmount,
      created_at: stored.createdAt
    }] : [],
    quotes: stored.quote ? [{
      id: stored.quote.id ?? `local-quote-${stored.id}`,
      version: Number(stored.quote.version ?? 1),
      items: Array.isArray(stored.quote.items) ? stored.quote.items : [],
      total_material: Number(stored.quote.total_material ?? productAmount),
      total_labor: Number(stored.quote.total_labor ?? laborAmount),
      total_final: Number(stored.quote.total_final ?? totalAmount),
      accepted_at: stored.quote.accepted_at ?? stored.createdAt,
      created_at: stored.quote.created_at ?? stored.createdAt
    }] : [],
    media: [],
    jobs: stored.reservation?.date ? [{
      id: `local-job-${stored.id}`,
      technician_id: null,
      assigned_technician_name: null,
      scheduled_at: `${stored.reservation.date}T${stored.reservation.time === "afternoon" || stored.reservation.time === "오후" ? "13:00:00" : "09:00:00"}+09:00`,
      status: stored.status === "scheduled" ? "scheduled" : "assigned",
      technicians: null
    }] : [],
    cancellations: [],
    is_test: false,
    test_note: null,
    deleted_at: null,
    deleted_reason: null,
    visit_fee: Number(stored.visitFee ?? stored.quote?.visit_fee ?? 0),
    localOnly: true
  };
}

export function localAdminOrderHistoryToAdminDetail(stored: LocalAdminOrderHistoryEntry) {
  const productAmount = Number(stored.totals?.productAmount ?? stored.totals?.onlinePaymentAmount ?? 0);
  const laborAmount = Number(stored.totals?.laborAmount ?? stored.totals?.onsitePaymentAmount ?? 0);
  const totalAmount = Number(stored.totals?.totalAmount ?? productAmount + laborAmount);
  const quoteItems = Array.isArray(stored.quote?.items) && stored.quote.items.length > 0
    ? stored.quote.items
    : [{
        sku: stored.serviceTypeCode,
        service_type_code: stored.serviceTypeCode,
        item_name: stored.productSummary || stored.item,
        qty: 1,
        metadata: {
          service_type_code: stored.serviceTypeCode,
          local_history_fallback: true
        }
      }];

  return {
    id: stored.id,
    order_number: stored.orderNumber,
    status: stored.status,
    total_amount: totalAmount,
    created_at: stored.createdAt,
    channel: "builduscare_web",
    source: "builduscare_web",
    reason: "product_order_request",
    service_type_code: stored.serviceTypeCode,
    skus: quoteItems,
    special_requests: stored.cashReceiptText ? `현금영수증: ${stored.cashReceiptText}` : "",
    inquiry_photos: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
    customers: {
      name: stored.customerName,
      phone: stored.phone,
      address_full: stored.roadAddress,
      address_apt: stored.detailAddress,
      acquisition_source: "builduscare_web"
    },
    homes: {
      address_full: stored.roadAddress,
      address_apt: stored.detailAddress,
      postal_code: stored.postalCode ?? null
    },
    payments: stored.payment ? [{
      id: `local-payment-${stored.id}`,
      status: stored.payment.status ?? "pending",
      amount: Number(stored.payment.amount ?? productAmount),
      provider: stored.payment.provider ?? "bank_transfer",
      online_payment_amount: Number(stored.totals?.onlinePaymentAmount ?? productAmount),
      onsite_payment_amount: Number(stored.totals?.onsitePaymentAmount ?? laborAmount),
      total_amount: totalAmount,
      created_at: stored.createdAt
    }] : [],
    quotes: [{
      id: stored.quote?.id ?? `local-quote-${stored.id}`,
      version: Number(stored.quote?.version ?? 1),
      items: quoteItems,
      total_material: Number(stored.quote?.total_material ?? productAmount),
      total_labor: Number(stored.quote?.total_labor ?? laborAmount),
      total_final: Number(stored.quote?.total_final ?? totalAmount),
      accepted_at: stored.quote?.accepted_at ?? stored.createdAt,
      created_at: stored.quote?.created_at ?? stored.createdAt
    }],
    media: [],
    jobs: stored.reservation?.date ? [{
      id: `local-job-${stored.id}`,
      technician_id: null,
      assigned_technician_name: null,
      scheduled_at: `${stored.reservation.date}T${stored.reservation.time === "afternoon" || stored.reservation.time === "오후" ? "13:00:00" : "09:00:00"}+09:00`,
      status: stored.status === "scheduled" ? "scheduled" : "assigned",
      technicians: null
    }] : [],
    cancellations: [],
    is_test: false,
    test_note: null,
    deleted_at: null,
    deleted_reason: null,
    visit_fee: Number(stored.visitFee ?? stored.quote?.visit_fee ?? 0),
    localOnly: true
  };
}

export function localAdminOrderToHistoryEntry(stored: LocalAdminOrderCookie): LocalAdminOrderHistoryEntry {
  const selected = Array.isArray(stored.selected) ? stored.selected : [];
  const first = selected[0];
  const serviceTypeCode = normalizeText(first?.serviceCode) || "photo_inquiry";
  return {
    id: stored.id,
    orderNumber: stored.orderNumber,
    status: stored.status,
    customerName: stored.customerName,
    phone: stored.phone,
    roadAddress: stored.roadAddress,
    detailAddress: stored.detailAddress,
    postalCode: stored.postalCode,
    item: stored.item,
    serviceTypeCode,
    requestType: "product_order",
    productSummary: first ? [first.brand, first.model ?? first.name].filter(Boolean).join(" ").trim() || stored.item : stored.item,
    photoCount: Number(stored.photoCount ?? 0),
    reservation: stored.reservation ?? null,
    totals: stored.totals ?? null,
    payment: stored.payment ? {
      status: stored.payment.status,
      amount: stored.payment.amount,
      provider: stored.payment.provider
    } : null,
    cashReceiptText: stored.cashReceipt?.text ?? "",
    quote: stored.quote ? {
      id: stored.quote.id,
      version: stored.quote.version,
      total_material: stored.quote.total_material,
      total_labor: stored.quote.total_labor,
      total_final: stored.quote.total_final,
      visit_fee: stored.quote.visit_fee,
      discount: stored.quote.discount,
      accepted_at: stored.quote.accepted_at,
      created_at: stored.quote.created_at
    } : null,
    visitFee: stored.visitFee,
    discount: stored.discount,
    createdAt: stored.createdAt
  };
}

export function localAdminDiagnosisToAdminListItem(stored: LocalAdminDiagnosisCookie) {
  return {
    id: stored.id,
    order_id: stored.orderId,
    service_type_code: stored.serviceTypeCode,
    service_code: stored.serviceTypeCode,
    image_urls: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
    photos: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
    result: stored.result ?? null,
    confidence: null,
    reason: stored.reason ?? null,
    details: null,
    recommendation: null,
    raw_response: {
      receipt_number: stored.orderNumber,
      order_number: stored.orderNumber,
      item: stored.item,
      customer: {
        name: stored.customerName,
        phone: stored.customerPhone
      },
      address: {
        full: [stored.roadAddress, stored.detailAddress].filter(Boolean).join(" "),
        roadAddress: stored.roadAddress,
        detailAddress: stored.detailAddress
      }
    },
    customer_name: stored.customerName,
    customer_phone: stored.customerPhone,
    created_at: stored.createdAt,
    is_test: false,
    test_marked_at: null,
    test_note: null,
    orders: {
      id: stored.orderId,
      order_number: stored.orderNumber,
      service_type_code: stored.serviceTypeCode,
      skus: [{
        service_type_code: stored.serviceTypeCode,
        qty: 1,
        metadata: { inquiry_only: true, request_type: "photo_check" }
      }],
      special_requests: "",
      inquiry_photos: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
      customers: {
        name: stored.customerName,
        phone: stored.customerPhone,
        address_full: stored.roadAddress,
        address_apt: stored.detailAddress
      },
      homes: {
        address_full: stored.roadAddress,
        address_apt: stored.detailAddress,
        postal_code: stored.postalCode ?? null
      }
    },
    localOnly: true
  };
}

export function localAdminDiagnosisHistoryToAdminListItem(stored: LocalAdminDiagnosisHistoryEntry) {
  return {
    id: stored.id,
    order_id: stored.orderId,
    service_type_code: stored.serviceTypeCode,
    service_code: stored.serviceTypeCode,
    image_urls: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
    photos: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
    result: stored.result ?? null,
    confidence: null,
    reason: stored.reason ?? null,
    details: null,
    recommendation: null,
    raw_response: {
      receipt_number: stored.orderNumber,
      order_number: stored.orderNumber,
      item: stored.item,
      customer: {
        name: stored.customerName,
        phone: stored.customerPhone
      },
      address: {
        full: [stored.roadAddress, stored.detailAddress].filter(Boolean).join(" "),
        roadAddress: stored.roadAddress,
        detailAddress: stored.detailAddress
      }
    },
    customer_name: stored.customerName,
    customer_phone: stored.customerPhone,
    created_at: stored.createdAt,
    is_test: false,
    test_marked_at: null,
    test_note: null,
    orders: {
      id: stored.orderId,
      order_number: stored.orderNumber,
      service_type_code: stored.serviceTypeCode,
      skus: [{
        service_type_code: stored.serviceTypeCode,
        qty: 1,
        metadata: { inquiry_only: true, request_type: "photo_check" }
      }],
      special_requests: "",
      inquiry_photos: Array.from({ length: Math.max(0, Number(stored.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
      customers: {
        name: stored.customerName,
        phone: stored.customerPhone,
        address_full: stored.roadAddress,
        address_apt: stored.detailAddress
      },
      homes: {
        address_full: stored.roadAddress,
        address_apt: stored.detailAddress,
        postal_code: stored.postalCode ?? null
      }
    },
    localOnly: true
  };
}
