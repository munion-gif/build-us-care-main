import { fail, ok } from "@/lib/api-response";
import { EVENT_TYPES } from "@/lib/event-types";
import {
  attachBuilduscareOrderPhotos,
  builduscarePhotoFiles,
  upsertBuilduscarePhotoDiagnosis
} from "@/lib/builduscare-photo-processing";
import { notifyNewOrder } from "@/lib/notify-admin";
import { createOrderDateKey, createOrderNumber } from "@/lib/orders";
import { createPaymentOrderId } from "@/lib/payment-amounts";
import { quoteVatIncludedAmount } from "@/lib/quote-totals";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { closedReservationReason, isBeforeMinReservationDate, isClosedReservationDate } from "@/lib/reservation-policy";
import {
  getProductLaborPrice,
  REPLACEMENT_PRODUCTS,
  replacementProductDisplayModel,
  replacementProductDisplayName,
  replacementProductSnapshot,
  type ReplacementProduct
} from "@/lib/replacement-products";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { after } from "next/server";
import {
  BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE,
  BUILDUSCARE_LOCAL_ADMIN_DIAGNOSIS_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_DIAGNOSES_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE,
  appendLocalAdminDiagnosisHistory,
  appendLocalAdminOrderHistory,
  localAdminOrderToHistoryEntry,
  readLocalAdminDiagnosisHistoryCookie,
  readLocalAdminOrderHistoryCookie,
  type LocalAdminDiagnosisHistoryEntry,
  type LocalAdminOrderHistoryEntry,
  type LocalAdminDiagnosisCookie,
  type LocalAdminOrderCookie
} from "@/lib/builduscare-local-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREATE_LIMIT = 5;
const CREATE_WINDOW_MS = 15 * 60 * 1000;
const BUILDUSCARE_SOURCE = "builduscare_web";
const SERVICE_BY_ITEM: Record<string, string> = {
  "사진 확인": "photo_inquiry",
  "양변기 교체": "toilet_replace",
  "세면대 교체": "basin_replace",
  "수전 교체": "faucet_replace",
  "비데 설치": "bidet_install",
  "환풍기 교체": "ventilator_replace",
  "샷시손잡이": "sash_handle",
  "도어핸들": "door_handle",
  "실리콘 재시공": "silicone_repair",
  "욕실 악세서리": "bath_accessory"
};

type SubmissionType = "product_order" | "photo_check";

type BuildusPayload = {
  deviceType?: "desktop" | "mobile";
  item?: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  address?: {
    roadAddress?: string;
    detailAddress?: string;
    postalCode?: string;
  };
  reservation?: {
    date?: number | string | null;
    time?: string | null;
  };
  selected?: Array<{ id?: string; qty?: number; selectedColor?: string; color?: string }>;
  selfDisposal?: boolean;
  totals?: {
    productAmount?: number;
    laborAmount?: number;
    disposalAmount?: number;
    totalAmount?: number;
  };
  cashReceipt?: {
    type?: string;
    identity?: string;
  };
};

type QuoteLine = {
  sku: string;
  item_name: string;
  qty: number;
  unit_labor: number;
  unit_material: number;
  option_total: number;
  line_labor: number;
  line_material: number;
  line_total: number;
  options: unknown[];
  material_skus: string[];
  metadata: Record<string, unknown>;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function cashReceiptSummary(value: BuildusPayload["cashReceipt"]) {
  const type = normalizeText(value?.type);
  const identity = normalizePhone(value?.identity);

  if (type === "personal") {
    return {
      type,
      identity,
      text: `개인 소득공제 / ${identity || "정보 입력 전"}`
    };
  }

  if (type === "business") {
    return {
      type,
      identity,
      text: `사업자 지출증빙 / ${identity || "정보 입력 전"}`
    };
  }

  return {
    type: "none",
    identity: "",
    text: "신청 안 함"
  };
}

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function roundedProductPrice(value: unknown) {
  const amount = integer(value);
  return quoteVatIncludedAmount(amount);
}

function parsePayload(value: FormDataEntryValue | null): BuildusPayload | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
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

function productById(id: string) {
  return REPLACEMENT_PRODUCTS.find((product) => product.id === id) ?? null;
}

function selectedProducts(payload: BuildusPayload) {
  return (Array.isArray(payload.selected) ? payload.selected : [])
    .map((entry) => {
      const id = normalizeText(entry?.id);
      const product = id ? productById(id) : null;
      if (!product) return null;
      const selectedColor = normalizeText(entry?.selectedColor ?? entry?.color);
      return {
        product,
        qty: Math.max(1, Math.min(20, integer(entry?.qty, 1))),
        selectedColor
      };
    })
    .filter((entry): entry is { product: ReplacementProduct; qty: number; selectedColor: string } => Boolean(entry));
}

function displayProductName(product: ReplacementProduct, selectedColor = "") {
  const name = replacementProductDisplayName(product);
  return selectedColor ? `${name} · ${selectedColor}` : name;
}

function buildOrderItems(entries: Array<{ product: ReplacementProduct; qty: number; selectedColor: string }>, fallbackItem: string, submissionType: SubmissionType) {
  if (entries.length === 0) {
    const serviceCode = SERVICE_BY_ITEM[fallbackItem] ?? "photo_inquiry";
    return [{
      service_type_code: serviceCode,
      item_name: `${fallbackItem || "사진 확인"} 상담`,
      qty: 1,
      unit_price: 0,
      options: [],
      metadata: {
        service_type_code: serviceCode,
        builduscare_web: true,
        request_type: "photo_check",
        inquiry_only: true
      }
    }];
  }

  return entries.map(({ product, qty, selectedColor }) => ({
    service_type_code: product.serviceCode,
    item_name: displayProductName(product, selectedColor),
    qty,
    unit_price: roundedProductPrice(product.price),
    options: selectedColor ? [{ label: "색상", value: selectedColor }] : [],
    metadata: {
      service_type_code: product.serviceCode,
      selected_replacement_product_id: product.id,
      selected_replacement_product_snapshot: replacementProductSnapshot(product),
      selected_color: selectedColor || null,
      request_type: submissionType,
      source: BUILDUSCARE_SOURCE
    }
  }));
}

function buildQuoteLines(entries: Array<{ product: ReplacementProduct; qty: number; selectedColor: string }>, selfDisposal: boolean) {
  return entries.map(({ product, qty, selectedColor }) => {
    const unitMaterial = roundedProductPrice(product.price);
    const unitLabor = quoteVatIncludedAmount(getProductLaborPrice(product.serviceCode, product));
    const disposalPerUnit = selfDisposal ? 0 : quoteVatIncludedAmount(10000);
    const lineLabor = (unitLabor + disposalPerUnit) * qty;
    const lineMaterial = unitMaterial * qty;

    return {
      sku: product.serviceCode,
      item_name: product.categoryName || displayProductName(product, selectedColor),
      qty,
      unit_labor: unitLabor + disposalPerUnit,
      unit_material: unitMaterial,
      option_total: 0,
      line_labor: lineLabor,
      line_material: lineMaterial,
      line_total: lineMaterial + lineLabor,
      options: selectedColor ? [{ label: "색상", value: selectedColor }] : [],
      material_skus: [],
      metadata: {
        service_type_code: product.serviceCode,
        selected_replacement_product_id: product.id,
        selected_replacement_product: replacementProductSnapshot(product),
        selected_replacement_product_snapshot: replacementProductSnapshot(product),
        selected_color: selectedColor || null,
        disposal_fee_per_unit: disposalPerUnit,
        source: BUILDUSCARE_SOURCE
      }
    } satisfies QuoteLine;
  });
}

function orderName(lines: QuoteLine[], fallbackItem: string) {
  const first = lines[0];
  if (!first) return fallbackItem || "사진 확인 신청";
  if (lines.length === 1) return first.item_name;
  return `${first.item_name} 외 ${lines.length - 1}개`;
}

function reservedDate(value: number | string | null | undefined) {
  const text = normalizeText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(`${text}T00:00:00+09:00`);
    return Number.isNaN(parsed.getTime()) ? null : text;
  }
  const day = integer(value);
  if (day < 1 || day > 30) return null;
  return `2026-06-${String(day).padStart(2, "0")}`;
}

function timeSlot(value: string | null | undefined) {
  if (value === "오전" || value === "morning") return "morning";
  if (value === "오후" || value === "afternoon") return "afternoon";
  return null;
}

function scheduledAtForSlot(date: string | null, slot: string | null) {
  if (!date || !slot) return null;
  return `${date}T${slot === "afternoon" ? "13:00:00" : "09:00:00"}+09:00`;
}

function localAccessToken() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createLocalBuildusOrderResponse(params: {
  request: Request;
  payload: BuildusPayload;
  submissionType: SubmissionType;
  name: string;
  phone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode: string;
  item: string;
  entries: Array<{ product: ReplacementProduct; qty: number; selectedColor: string }>;
  quoteLines: QuoteLine[];
  totalMaterial: number;
  totalLabor: number;
  totalFinal: number;
  reserved: string | null;
  cashReceipt: ReturnType<typeof cashReceiptSummary>;
  photoCount: number;
  primaryServiceCode: string;
}) {
  const orderNumber = createOrderNumber();
  const orderId = `local-${Date.now().toString(36)}`;
  const accessToken = localAccessToken();
  const isProductOrder = params.submissionType === "product_order";
  const transferUrl = isProductOrder && params.totalMaterial > 0
    ? `/payment/transfer?${new URLSearchParams({
        orderId,
        accessToken,
        amount: String(params.totalFinal),
        productAmount: String(params.totalMaterial),
        serviceFeeAmount: String(params.totalLabor),
        onsiteAmount: "0",
        totalAmount: String(params.totalFinal)
      }).toString()}`
    : null;

  const response = ok(
      {
        order: {
        id: orderId,
        orderNumber,
        accessToken,
        status: isProductOrder ? "pending_product_payment" : "inquiry",
        statusUrl: `/orders/${orderId}?accessToken=${accessToken}`,
        transferUrl,
        customerName: params.name,
        phone: params.phone,
        roadAddress: params.roadAddress,
        detailAddress: params.detailAddress,
        postalCode: params.postalCode,
        item: params.item,
        requestType: params.submissionType,
        selected: params.entries.map(({ product, qty, selectedColor }) => ({
          id: product.id,
          brand: product.brand,
          name: displayProductName(product, selectedColor),
          model: replacementProductDisplayModel(product),
          image: product.image ?? "",
          sku: product.sku,
          color: (selectedColor || product.color) ?? "",
          selectedColor: selectedColor || "",
          serviceCode: product.serviceCode,
          categoryName: product.categoryName,
          qty,
          price: roundedProductPrice(product.price)
        })),
        photoCount: params.photoCount,
        reservation: {
          date: params.reserved,
          time: params.payload.reservation?.time ?? null
        },
          totals: {
            productAmount: params.totalMaterial,
            laborAmount: params.totalLabor,
            totalAmount: params.totalFinal,
            onlinePaymentAmount: params.totalFinal,
            onsitePaymentAmount: 0
          },
          payment: isProductOrder
            ? {
                id: `local-payment-${Date.now().toString(36)}`,
                status: params.totalMaterial > 0 ? "pending" : "done",
                amount: params.totalFinal,
                provider: "bank_transfer"
              }
          : null,
        cashReceipt: isProductOrder
          ? {
              type: params.cashReceipt.type,
              identity: params.cashReceipt.identity,
              text: params.cashReceipt.text
            }
          : null,
        quote: params.quoteLines.length > 0
          ? {
              id: `local-quote-${Date.now().toString(36)}`,
              items: params.quoteLines,
              total_material: params.totalMaterial,
              total_labor: params.totalLabor,
              total_final: params.totalFinal
            }
          : null,
          diagnosisId: null,
          localOnly: true
        }
      },
      { status: 201 }
  );
  const orderCookieValue: LocalAdminOrderCookie = {
    id: orderId,
    orderNumber,
    accessToken,
    status: isProductOrder ? "pending_product_payment" : "inquiry",
    customerName: params.name,
    phone: params.phone,
    roadAddress: params.roadAddress,
    detailAddress: params.detailAddress,
    postalCode: params.postalCode,
    item: params.item,
    requestType: params.submissionType,
    selected: params.entries.map(({ product, qty, selectedColor }) => ({
      id: product.id,
      brand: product.brand,
      name: displayProductName(product, selectedColor),
      model: replacementProductDisplayModel(product),
      image: product.image ?? "",
      sku: product.sku,
      color: (selectedColor || product.color) ?? "",
      selectedColor: selectedColor || "",
      serviceCode: product.serviceCode,
      categoryName: product.categoryName,
      qty,
      price: roundedProductPrice(product.price)
    })),
    photoCount: params.photoCount,
    reservation: { date: params.reserved, time: params.payload.reservation?.time ?? null },
    totals: {
      productAmount: params.totalMaterial,
      laborAmount: params.totalLabor,
      totalAmount: params.totalFinal,
      onlinePaymentAmount: params.totalFinal,
      onsitePaymentAmount: 0
    },
    payment: isProductOrder
      ? {
          id: `local-payment-${Date.now().toString(36)}`,
          status: params.totalMaterial > 0 ? "pending" : "done",
          amount: params.totalFinal,
          provider: "bank_transfer"
        }
      : null,
    cashReceipt: isProductOrder ? { type: params.cashReceipt.type, identity: params.cashReceipt.identity, text: params.cashReceipt.text } : null,
    quote: params.quoteLines.length > 0
      ? {
          id: `local-quote-${Date.now().toString(36)}`,
          total_material: params.totalMaterial,
          total_labor: params.totalLabor,
          total_final: params.totalFinal
        }
      : null,
    localOnly: true,
    createdAt: new Date().toISOString()
  };
  const requestCookieHeader = params.request.headers.get("cookie");
  const orderHistory = appendLocalAdminOrderHistory(
    readLocalAdminOrderHistoryCookie(readCookieValue(requestCookieHeader, BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE)),
    localAdminOrderToHistoryEntry(orderCookieValue)
  );
  response.cookies.set(BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE, JSON.stringify(orderCookieValue), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE
  });
  if (isProductOrder) {
    response.cookies.set(BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE, JSON.stringify(orderHistory), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE
    });
  }
  if (!isProductOrder) {
    const diagnosisCookieValue: LocalAdminDiagnosisCookie = {
      id: `local-diagnosis-${Date.now().toString(36)}`,
      orderId,
      orderNumber,
      serviceTypeCode: params.primaryServiceCode,
      item: params.item,
      customerName: params.name,
      customerPhone: params.phone,
      roadAddress: params.roadAddress,
      detailAddress: params.detailAddress,
      postalCode: params.postalCode,
      photoCount: params.photoCount,
      result: null,
      reason: params.item,
      createdAt: orderCookieValue.createdAt,
      localOnly: true
    };
    const diagnosisHistory = appendLocalAdminDiagnosisHistory(
      readLocalAdminDiagnosisHistoryCookie(readCookieValue(requestCookieHeader, BUILDUSCARE_LOCAL_ADMIN_DIAGNOSES_COOKIE)),
      {
        id: diagnosisCookieValue.id,
        orderId,
        orderNumber,
        serviceTypeCode: params.primaryServiceCode,
        item: params.item,
        customerName: params.name,
        customerPhone: params.phone,
        roadAddress: params.roadAddress,
        detailAddress: params.detailAddress,
        postalCode: params.postalCode,
        photoCount: params.photoCount,
        result: null,
        reason: params.item,
        createdAt: diagnosisCookieValue.createdAt
      } satisfies LocalAdminDiagnosisHistoryEntry
    );
    response.cookies.set(BUILDUSCARE_LOCAL_ADMIN_DIAGNOSIS_COOKIE, JSON.stringify(diagnosisCookieValue), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE
    });
    response.cookies.set(BUILDUSCARE_LOCAL_ADMIN_DIAGNOSES_COOKIE, JSON.stringify(diagnosisHistory), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE
    });
  }
  return response;
}

async function createSequentialBuildusOrderNumber(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dateKey = createOrderDateKey();
  const prefix = `BO-${dateKey}-`;
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .like("order_number", `${prefix}%`);

  if (error) throw new Error(error.message);
  return createOrderNumber(new Date(), (count ?? 0) + 1);
}

async function createBuildusOrderBase(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  name: string;
  phone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode: string;
  deviceType?: "desktop" | "mobile";
  orderReason: string;
  selfDiagnosis: string;
  orderItems: ReturnType<typeof buildOrderItems>;
  primaryServiceCode: string;
  specialRequests: string;
  productAmount: number;
  laborAmount: number;
}) {
  const {
    supabase,
    name,
    phone,
    roadAddress,
    detailAddress,
    postalCode,
    deviceType,
    orderReason,
    selfDiagnosis,
    orderItems,
    primaryServiceCode,
    specialRequests,
    productAmount,
    laborAmount
  } = params;
  const addressFull = [roadAddress, detailAddress].filter(Boolean).join(" ");
  const channel = deviceType === "mobile" ? "mobile_web" : "web";
  const orderStatus = productAmount > 0 ? "pending_product_payment" : "inquiry";
  const subtotalAmount = productAmount + laborAmount;
  const totalAmount = subtotalAmount;

  const [customerResult, orderNumber] = await Promise.all([
    supabase
      .from("customers")
      .upsert({
        phone,
        name,
        acquisition_source: BUILDUSCARE_SOURCE,
        address_full: addressFull,
        address_dong: "unknown",
        address_apt: detailAddress || null,
        housing_type: "unknown"
      }, { onConflict: "phone" })
      .select("*")
      .single(),
    createSequentialBuildusOrderNumber(supabase)
  ]);
  if (customerResult.error) throw new Error(customerResult.error.message);
  const customer = customerResult.data;

  const { data: home, error: homeError } = await supabase
    .from("homes")
    .insert({
      customer_id: customer.id,
      address_full: addressFull,
      address_dong: "unknown",
      address_apt: detailAddress || null,
      postal_code: postalCode || null,
      size_pyung: 0,
      building_type: "unknown"
    })
    .select("*")
    .single();
  if (homeError) throw new Error(homeError.message);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: customer.id,
      home_id: home.id,
      status: orderStatus,
      skus: orderItems.map((orderItem) => ({
        sku: orderItem.service_type_code,
        qty: orderItem.qty,
        service_type: "replacement_product",
        options: orderItem.options,
        material_skus: [],
        metadata: orderItem.metadata
      })),
      channel,
      source: BUILDUSCARE_SOURCE,
      reason: orderReason,
      urgency: "scheduled",
      self_diagnosis: selfDiagnosis,
      service_type_code: primaryServiceCode,
      visit_fee: 0,
      subtotal_amount: subtotalAmount,
      total_amount: totalAmount,
      online_payment_amount: totalAmount,
      onsite_payment_amount: 0,
      onsite_payment_status: "DONE",
      special_requests: specialRequests,
      inquiry_photos: [],
      is_test: false
    })
    .select("*")
    .single();
  if (orderError) throw new Error(orderError.message);

  return { customer, home, order };
}

export async function POST(request: Request) {
  const submissionType: SubmissionType =
    request.headers.get("x-builduscare-submission-type") === "photo_check" ? "photo_check" : "product_order";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("BAD_REQUEST", "접수 정보를 다시 확인해주세요.", 400);
  }
  const payload = parsePayload(formData.get("payload"));
  if (!payload) {
    return fail("BAD_REQUEST", "접수 정보를 다시 확인해주세요.", 400);
  }

  const name = normalizeText(payload.customer?.name);
  const phone = normalizePhone(payload.customer?.phone);
  const roadAddress = normalizeText(payload.address?.roadAddress);
  const detailAddress = normalizeText(payload.address?.detailAddress);
  const postalCode = normalizeText(payload.address?.postalCode);
  const item = submissionType === "photo_check" ? normalizeText(payload.item) || "사진 확인" : normalizeText(payload.item);

  if (!name) return fail("BAD_REQUEST", "성함을 입력해주세요.", 400);
  if (phone.length < 8) return fail("BAD_REQUEST", "연락처를 다시 확인해주세요.", 400);
  if (!roadAddress) return fail("BAD_REQUEST", "주소를 입력해주세요.", 400);
  if (submissionType === "product_order" && !item) return fail("BAD_REQUEST", "품목을 선택해주세요.", 400);

  const rateLimit = checkRateLimit(`builduscare-${submissionType}:${getClientIp(request.headers)}:${phone}`, {
    limit: CREATE_LIMIT,
    windowMs: CREATE_WINDOW_MS
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "접수 요청이 많습니다. 잠시 후 다시 시도해주세요.");
  }

  const entries = submissionType === "photo_check" ? [] : selectedProducts(payload);
  if (submissionType === "product_order" && entries.length === 0) {
    return fail("BAD_REQUEST", "제품을 선택해주세요.", 400);
  }
  const orderItems = buildOrderItems(entries, item, submissionType);
  const primaryServiceCode = entries[0]?.product.serviceCode ?? SERVICE_BY_ITEM[item] ?? orderItems[0]?.service_type_code;
  const orderReason = submissionType === "photo_check" ? "photo_check_request" : "product_order_request";
  const selfDiagnosis =
    submissionType === "photo_check"
      ? "Build us Care 사진 확인 접수"
      : "Build us Care 제품 주문 접수";
  const cashReceipt = cashReceiptSummary(payload.cashReceipt);
  const specialRequests =
    submissionType === "photo_check"
      ? "Build us Care 사진 확인 신청"
      : [
          `Build us Care 제품 주문 신청${payload.selfDisposal ? " / 폐기물 직접 처리" : ""}`,
          `현금영수증: ${cashReceipt.text}`
        ].join("\n");
  const quoteLines = entries.length > 0 ? buildQuoteLines(entries, Boolean(payload.selfDisposal)) : [];
  const totalMaterial = quoteLines.reduce((sum, line) => sum + line.line_material, 0);
  const totalLabor = quoteLines.reduce((sum, line) => sum + line.line_labor + line.option_total, 0);
  const subtotalFinal = totalMaterial + totalLabor;
  const totalFinal = subtotalFinal;
  const reserved = reservedDate(payload.reservation?.date);
  const slot = timeSlot(payload.reservation?.time);
  if (reserved && isBeforeMinReservationDate(reserved)) {
    return fail("INVALID_DATE", "제품과 일정 준비 기간 때문에 방문 일정은 영업일 기준 4일 이후 날짜부터 가능합니다.", 400);
  }
  if (reserved && isClosedReservationDate(reserved)) {
    return fail("SLOT_CLOSED", closedReservationReason(reserved), 409);
  }
  const scheduledAt = scheduledAtForSlot(reserved, slot);
  const photoFiles = builduscarePhotoFiles(formData);

  if (!hasSupabaseEnv()) {
    if (process.env.NODE_ENV === "production") {
      return fail("supabase_not_configured", "Supabase is required to create builduscare orders.", 500);
    }

    return createLocalBuildusOrderResponse({
      request,
      payload,
      submissionType,
      name,
      phone,
      roadAddress,
      detailAddress,
      postalCode,
      item,
      entries,
      quoteLines,
      totalMaterial,
      totalLabor,
      totalFinal,
      reserved,
      cashReceipt,
      photoCount: photoFiles.length,
      primaryServiceCode
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { customer, order } = await createBuildusOrderBase({
      supabase,
      name,
      phone,
      roadAddress,
      detailAddress,
      postalCode,
      deviceType: payload.deviceType,
      orderReason,
      selfDiagnosis,
      orderItems,
      primaryServiceCode,
      specialRequests,
      productAmount: totalMaterial,
      laborAmount: totalLabor
    });
    const jobPromise = supabase
      .from("jobs")
      .insert({
        order_id: order.id,
        status: scheduledAt ? "assigned" : "received",
        scheduled_at: scheduledAt,
        scheduled_date: reserved,
        expected_minutes: 0
      })
      .select("*")
      .single();
    const quotePaymentPromise = entries.length > 0
      ? (async () => {
          const now = new Date().toISOString();
          const { data: insertedQuote, error: quoteError } = await supabase
            .from("quotes")
            .insert({
              order_id: order.id,
              version: 1,
              items: quoteLines,
              total_material: totalMaterial,
              total_labor: totalLabor,
              visit_fee: 0,
              discount: 0,
              total_final: totalFinal,
              accepted_at: now
            })
            .select("*")
            .single();
          if (quoteError) throw new Error(quoteError.message);

          const providerOrderId = createPaymentOrderId();
          const { data: insertedPayment, error: paymentError } = await supabase
            .from("payments")
            .insert({
              order_id: order.id,
              quote_id: insertedQuote.id,
              provider: "bank_transfer",
              provider_order_id: providerOrderId,
              method: "transfer",
              order_name: orderName(quoteLines, item),
              amount: totalFinal,
              status: totalMaterial > 0 ? "pending" : "done",
              provider_status: totalMaterial > 0 ? "WAITING_DEPOSIT" : "DONE",
              requested_at: now,
              product_amount: totalMaterial,
              service_fee_amount: totalLabor,
              total_amount: totalFinal,
              online_payment_amount: totalFinal,
              onsite_payment_amount: 0,
              onsite_payment_status: "DONE",
              quote_status: "pending_product_payment"
            })
            .select("*")
            .single();
          if (paymentError) throw new Error(paymentError.message);
          return { quote: insertedQuote, payment: insertedPayment };
        })()
      : Promise.resolve({ quote: null, payment: null });

    const [jobResult, quotePayment] = await Promise.all([jobPromise, quotePaymentPromise]);
    if (jobResult.error) throw new Error(jobResult.error.message);
    const quote = quotePayment.quote;
    const payment = quotePayment.payment;
    let transferUrl: string | null = null;
    if (payment) {
      const transferParams = new URLSearchParams({
        orderId: order.id,
        accessToken: order.access_token,
        amount: String(totalFinal),
        productAmount: String(totalMaterial),
        serviceFeeAmount: String(totalLabor),
        onsiteAmount: "0",
        totalAmount: String(totalFinal)
      });
      transferUrl = `/payment/transfer?${transferParams.toString()}`;
    }
    let diagnosisId: string | null = null;
    if (submissionType === "photo_check") {
      try {
        const diagnosis = await upsertBuilduscarePhotoDiagnosis({
          orderId: order.id,
          orderNumber: order.order_number,
          serviceCode: primaryServiceCode,
          photoPaths: [],
          name,
          phone,
          roadAddress,
          detailAddress,
          postalCode,
          item
        });
        diagnosisId = diagnosis?.id ?? null;
      } catch (error) {
        console.error("Build us Care immediate diagnosis creation failed", error);
      }
    }

    after(async () => {
      await Promise.allSettled([
        (async () => {
          if (photoFiles.length === 0 && submissionType !== "photo_check") return null;
          try {
            const photoPaths = photoFiles.length > 0 ? await attachBuilduscareOrderPhotos(order.id, photoFiles) : [];
            if (submissionType !== "photo_check") return photoPaths;
            return await upsertBuilduscarePhotoDiagnosis({
              orderId: order.id,
              orderNumber: order.order_number,
              serviceCode: primaryServiceCode,
              photoPaths,
              name,
              phone,
              roadAddress,
              detailAddress,
              postalCode,
              item
            });
          } catch (error) {
            console.error("Build us Care photo processing failed", error);
            return null;
          }
        })(),
        supabase.from("job_status_logs").insert({
          job_id: jobResult.data.id,
          from_status: null,
          to_status: jobResult.data.status,
          memo: "Build us Care 접수와 함께 작업 생성"
        }),
        supabase.from("events").insert({
          event_type: EVENT_TYPES.QUOTE_SUBMITTED,
          order_id: order.id,
          customer_id: customer.id,
          source: BUILDUSCARE_SOURCE,
          device_type: payload.deviceType === "mobile" ? "mobile" : "desktop",
          service_code: primaryServiceCode,
          properties: {
            order_number: order.order_number,
            request_type: submissionType,
            total_amount: totalFinal
          }
        }),
        payment
          ? supabase.from("events").insert({
              event_type: EVENT_TYPES.PAYMENT_STARTED,
              order_id: order.id,
              customer_id: customer.id,
              service_code: primaryServiceCode,
              properties: {
                source: BUILDUSCARE_SOURCE,
                payment_id: payment.id,
                quote_id: quote?.id,
                product_amount: totalMaterial,
                service_fee_amount: totalLabor,
                total_amount: totalFinal
              }
            })
          : Promise.resolve(null),
        supabase.from("notifications").insert({
          order_id: order.id,
          channel: "mock",
          template_code: "order_submitted",
          recipient: phone,
          send_status: "queued",
          payload: { order_number: order.order_number, source: BUILDUSCARE_SOURCE }
        }),
        notifyNewOrder({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: name,
          serviceType: primaryServiceCode,
          addressFull: [roadAddress, detailAddress].filter(Boolean).join(" ")
        })
      ]);
    });

    return ok(
      {
        order: {
          id: order.id,
          orderNumber: order.order_number,
          accessToken: order.access_token,
          status: order.status,
          statusUrl: `/orders/${order.id}?accessToken=${order.access_token}`,
          transferUrl,
          customerName: name,
          phone,
          roadAddress,
          detailAddress,
          postalCode,
          item,
          requestType: submissionType,
          selected: entries.map(({ product, qty, selectedColor }) => ({
            id: product.id,
            brand: product.brand,
            name: displayProductName(product, selectedColor),
            model: replacementProductDisplayModel(product),
            image: product.image ?? "",
            sku: product.sku,
            color: (selectedColor || product.color) ?? "",
            selectedColor: selectedColor || "",
            serviceCode: product.serviceCode,
            categoryName: product.categoryName,
            qty,
            price: roundedProductPrice(product.price)
          })),
          photoCount: photoFiles.length,
          reservation: {
            date: reserved,
            time: payload.reservation?.time ?? null
          },
          totals: {
            productAmount: payment ? Number(payment.product_amount ?? payment.amount ?? 0) : 0,
            laborAmount: payment ? Number(payment.service_fee_amount ?? 0) : 0,
            totalAmount: payment ? Number(payment.total_amount ?? 0) : 0,
            onlinePaymentAmount: payment ? Number(payment.online_payment_amount ?? payment.amount ?? 0) : 0,
            onsitePaymentAmount: payment ? Number(payment.onsite_payment_amount ?? 0) : 0
          },
          payment: payment
            ? {
                id: payment.id,
                status: payment.status,
                amount: payment.amount,
                provider: payment.provider
              }
            : null,
          cashReceipt:
            submissionType === "product_order"
              ? {
                  type: cashReceipt.type,
                  identity: cashReceipt.identity,
                  text: cashReceipt.text
                }
              : null,
          quote,
          diagnosisId
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "접수 저장에 실패했습니다.", 500);
  }
}
