import {
  BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE,
  readLocalAdminOrderCookie,
  readLocalAdminOrderHistoryCookie,
  type LocalAdminOrderCookie,
  type LocalAdminOrderHistoryEntry
} from "@/lib/builduscare-local-admin";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function readCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) return null;
  const entries = cookieHeader.split(/;\s*/);
  for (const entry of entries) {
    const [name, ...rest] = entry.split("=");
    if (name === cookieName) return rest.join("=");
  }
  return null;
}

function slotToScheduledAt(date?: string | null, time?: string | null) {
  if (!date) return null;
  const hour = time === "afternoon" || time === "오후" ? "13:00:00" : "09:00:00";
  return `${date}T${hour}+09:00`;
}

function selectedSkus(selected: LocalAdminOrderCookie["selected"], fallbackItem: string, fallbackServiceCode = "photo_inquiry") {
  const items = Array.isArray(selected) ? selected : [];
  if (items.length === 0) {
    return [
      {
        sku: fallbackServiceCode,
        service_type_code: fallbackServiceCode,
        item_name: fallbackItem || "사진 확인",
        qty: 1
      }
    ];
  }
  return items.map((item) => ({
    sku: item.serviceCode ?? item.sku ?? fallbackServiceCode,
    service_type_code: item.serviceCode ?? item.sku ?? fallbackServiceCode,
    item_name: (item.name ?? item.model ?? item.id ?? fallbackItem) || "선택 제품",
    qty: Number(item.qty ?? 1)
  }));
}

export function readLocalBuildusOrderCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  return readLocalAdminOrderCookie(readCookieValue(cookieHeader, BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE));
}

export function readLocalBuildusOrderHistory(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  return readLocalAdminOrderHistoryCookie(readCookieValue(cookieHeader, BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE));
}

export function matchLocalBuildusOrderByLookup(request: Request, params: { orderNumber?: string | null; customerName?: string | null }) {
  const wantedOrderNumber = normalizeText(params.orderNumber).toUpperCase();
  const wantedCustomerName = normalizeText(params.customerName);
  if (!wantedOrderNumber || !wantedCustomerName) return null;

  const latest = readLocalBuildusOrderCookie(request);
  if (latest) {
    const latestOrderNumber = normalizeText(latest.orderNumber).toUpperCase();
    const latestCustomerName = normalizeText(latest.customerName);
    if (latestOrderNumber === wantedOrderNumber && latestCustomerName === wantedCustomerName) {
      return latest;
    }
  }

  const history = readLocalBuildusOrderHistory(request);
  return history.find((entry) => {
    const entryOrderNumber = normalizeText(entry.orderNumber).toUpperCase();
    const entryCustomerName = normalizeText(entry.customerName);
    return entryOrderNumber === wantedOrderNumber && entryCustomerName === wantedCustomerName;
  }) ?? null;
}

export function matchLocalBuildusOrderFromRequest(request: Request, params: { orderId?: string | null; accessToken?: string | null }) {
  const orderId = normalizeText(params.orderId);
  const accessToken = normalizeText(params.accessToken);
  const latest = readLocalBuildusOrderCookie(request);
  if (latest) {
    const latestOrderId = normalizeText(latest.id);
    const latestAccessToken = normalizeText(latest.accessToken);
    if ((!orderId || latestOrderId === orderId) && (!accessToken || (latestAccessToken && latestAccessToken === accessToken))) {
      return latest;
    }
  }
  const history = readLocalBuildusOrderHistory(request);
  if (orderId) {
    const historyMatch = history.find((entry) => normalizeText(entry.id) === orderId);
    if (historyMatch) return historyMatch;
  }
  return null;
}

export function localBuildusOrderCookieToStatusOrder(stored: LocalAdminOrderCookie | LocalAdminOrderHistoryEntry) {
  const isFull = "selected" in stored;
  const selected = isFull && Array.isArray((stored as LocalAdminOrderCookie).selected) ? (stored as LocalAdminOrderCookie).selected : [];
  const productAmount = Number(stored.totals?.productAmount ?? stored.totals?.onlinePaymentAmount ?? 0);
  const laborAmount = Number(stored.totals?.laborAmount ?? stored.totals?.onsitePaymentAmount ?? 0);
  const totalAmount = Number(stored.totals?.totalAmount ?? productAmount + laborAmount);
  const scheduledAt = slotToScheduledAt(stored.reservation?.date ?? null, stored.reservation?.time ?? null);
  const serviceCode = isFull ? normalizeText(selected[0]?.serviceCode) || "photo_inquiry" : normalizeText(stored.serviceTypeCode) || "photo_inquiry";
  const createdAt = stored.createdAt || new Date().toISOString();

  return {
    id: stored.id,
    order_number: stored.orderNumber,
    status: stored.status,
    localOnly: true,
    created_at: createdAt,
    service_type_code: serviceCode,
    total_amount: totalAmount,
    online_payment_amount: Number(stored.totals?.onlinePaymentAmount ?? productAmount),
    onsite_payment_amount: Number(stored.totals?.onsitePaymentAmount ?? laborAmount),
    skus: selectedSkus(selected, stored.item, serviceCode),
    special_requests: isFull
      ? stored.cashReceipt?.text ? `현금영수증: ${stored.cashReceipt.text}` : ""
      : stored.cashReceiptText ? `현금영수증: ${stored.cashReceiptText}` : "",
    customer: {
      name: stored.customerName,
      phone: isFull ? stored.phone : stored.phone
    },
    home: {
      address_full: [stored.roadAddress, stored.detailAddress].filter(Boolean).join(" ") || stored.roadAddress
    },
    quote: isFull && stored.quote
      ? {
          id: stored.quote.id ?? `local-quote-${stored.id}`,
          version: 1,
          total_final: Number(stored.quote.total_final ?? totalAmount),
          accepted_at: createdAt,
          items: Array.isArray(stored.quote.items) ? stored.quote.items : []
        }
      : !isFull
        ? {
            id: `local-quote-${stored.id}`,
            version: 1,
            total_final: totalAmount,
            accepted_at: createdAt,
            items: [{
              sku: serviceCode,
              item_name: stored.productSummary || stored.item,
              qty: 1
            }]
          }
      : null,
    quotes: isFull && stored.quote
      ? [
          {
            id: stored.quote.id ?? `local-quote-${stored.id}`,
            version: 1,
            total_final: Number(stored.quote.total_final ?? totalAmount),
            accepted_at: createdAt,
            items: Array.isArray(stored.quote.items) ? stored.quote.items : []
          }
        ]
      : !isFull
        ? [
            {
              id: `local-quote-${stored.id}`,
              version: 1,
              total_final: totalAmount,
              accepted_at: createdAt,
              items: [{
                sku: serviceCode,
                item_name: stored.productSummary || stored.item,
                qty: 1
              }]
            }
          ]
      : [],
    payments: stored.payment
      ? [
          {
            id: ("id" in stored.payment && stored.payment.id ? stored.payment.id : `local-payment-${stored.id}`),
            status: stored.payment.status ?? "pending",
            provider: stored.payment.provider ?? "bank_transfer",
            amount: Number(stored.payment.amount ?? productAmount),
            total_amount: totalAmount,
            online_payment_amount: Number(stored.totals?.onlinePaymentAmount ?? productAmount),
            onsite_payment_amount: Number(stored.totals?.onsitePaymentAmount ?? laborAmount),
            created_at: createdAt
          }
        ]
      : [],
    jobs: scheduledAt
      ? [
          {
            id: `local-job-${stored.id}`,
            status: stored.status === "scheduled" ? "scheduled" : "assigned",
            scheduled_at: scheduledAt,
            created_at: createdAt,
            technicians: null
          }
        ]
      : [],
    reservations: stored.reservation?.date
      ? [
          {
            id: `local-reservation-${stored.id}`,
            reserved_date: stored.reservation.date,
            time_slot: stored.reservation.time === "afternoon" || stored.reservation.time === "오후" ? "afternoon" : "morning",
            status: "confirmed",
            created_at: createdAt
          }
        ]
      : [],
    feedbacks: [],
    media: []
  };
}

export function findLocalBuildusOrdersByPhone(request: Request, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return [];

  const latest = readLocalBuildusOrderCookie(request);
  const history = readLocalBuildusOrderHistory(request);
  const results: Array<LocalAdminOrderCookie | LocalAdminOrderHistoryEntry> = [];

  if (latest && normalizePhone(latest.phone) === normalizedPhone) {
    results.push(latest);
  }

  for (const entry of history) {
    if (normalizePhone(entry.phone) !== normalizedPhone) continue;
    if (results.some((item) => normalizeText((item as { id?: string }).id) === normalizeText(entry.id))) continue;
    results.push(entry);
  }

  return results;
}

export function localBuildusOrderSummary(order: LocalAdminOrderCookie | LocalAdminOrderHistoryEntry) {
  const isFull = "selected" in order;
  const serviceTypeCode = isFull
    ? normalizeText(order.selected?.[0]?.serviceCode) || "photo_inquiry"
    : normalizeText(order.serviceTypeCode) || "photo_inquiry";
  const scheduledAt = slotToScheduledAt(order.reservation?.date ?? null, order.reservation?.time ?? null);
  const itemName = isFull
    ? selectedSkus(order.selected, order.item, serviceTypeCode)[0]?.item_name ?? order.item
    : order.productSummary || order.item;

  return {
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    created_at: order.createdAt,
    service_type_code: serviceTypeCode,
    skus: [
      {
        sku: serviceTypeCode,
        service_type_code: serviceTypeCode,
        item_name: itemName,
        qty: 1
      }
    ],
    jobs: scheduledAt
      ? [
          {
            id: `local-job-${order.id}`,
            assigned_technician_name: null,
            status: order.status === "scheduled" ? "scheduled" : "assigned",
            completed_at: null
          }
        ]
      : []
  };
}

export function localBuildusOrderToLookupOrder(order: LocalAdminOrderCookie | LocalAdminOrderHistoryEntry) {
  const isFull = "selected" in order;
  const selectedRows = isFull
    ? (Array.isArray(order.selected) ? order.selected : []).map((item) => ({
        id: item.id ?? item.sku ?? item.serviceCode ?? "",
        brand: item.brand ?? undefined,
        name: item.name ?? item.model ?? item.id ?? order.item,
        image: item.image ?? "",
        qty: Number(item.qty ?? 1),
        price: Number(item.price ?? 0),
        selectedColor: item.selectedColor ?? item.color ?? undefined,
        categoryName: item.categoryName ?? undefined,
        serviceCode: item.serviceCode ?? item.sku ?? undefined
      }))
    : [
        {
          id: order.serviceTypeCode,
          brand: undefined,
          name: order.productSummary || order.item,
          image: "",
          qty: 1,
          price: Number(order.totals?.productAmount ?? order.totals?.onlinePaymentAmount ?? 0),
          selectedColor: undefined,
          categoryName: undefined,
          serviceCode: order.serviceTypeCode
        }
      ];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusUrl: "accessToken" in order && order.accessToken ? `/orders/${order.id}?accessToken=${order.accessToken}` : undefined,
    transferUrl:
      Number(order.totals?.productAmount ?? order.totals?.onlinePaymentAmount ?? 0) > 0 &&
      "accessToken" in order &&
      order.accessToken
        ? `/payment/transfer?${new URLSearchParams({
            orderId: order.id,
            accessToken: order.accessToken,
            amount: String(Number(order.totals?.productAmount ?? order.totals?.onlinePaymentAmount ?? 0)),
            productAmount: String(Number(order.totals?.productAmount ?? order.totals?.onlinePaymentAmount ?? 0)),
            serviceFeeAmount: String(Number(order.totals?.laborAmount ?? order.totals?.onsitePaymentAmount ?? 0)),
            onsiteAmount: String(Number(order.totals?.onsitePaymentAmount ?? order.totals?.laborAmount ?? 0)),
            totalAmount: String(Number(order.totals?.totalAmount ?? 0))
          }).toString()}`
        : null,
    serviceName: order.item,
    customerName: order.customerName,
    phone: "phone" in order ? order.phone : "",
    roadAddress: order.roadAddress,
    detailAddress: order.detailAddress,
    selected: selectedRows,
    cashReceipt: ("cashReceipt" in order && order.cashReceipt?.text)
      ? { text: order.cashReceipt.text }
      : ("cashReceiptText" in order && order.cashReceiptText)
        ? { text: order.cashReceiptText }
        : null,
    photoCount: Number(order.photoCount ?? 0),
    reservation: order.reservation?.date
      ? {
          date: order.reservation.date,
          time: order.reservation.time ?? null,
          status: order.status === "scheduled" ? "scheduled" : "confirmed"
        }
      : null,
    totals: {
      productAmount: Number(order.totals?.productAmount ?? order.totals?.onlinePaymentAmount ?? 0),
      laborAmount: Number(order.totals?.laborAmount ?? order.totals?.onsitePaymentAmount ?? 0),
      totalAmount: Number(order.totals?.totalAmount ?? 0),
      onsitePaymentAmount: Number(order.totals?.onsitePaymentAmount ?? order.totals?.laborAmount ?? 0),
      onlinePaymentAmount: Number(order.totals?.onlinePaymentAmount ?? order.totals?.productAmount ?? 0)
    },
    payment: order.payment
      ? {
          status: order.payment.status ?? undefined,
          provider: order.payment.provider ?? undefined,
          amount: Number(order.payment.amount ?? order.totals?.productAmount ?? 0)
        }
      : null
  };
}
