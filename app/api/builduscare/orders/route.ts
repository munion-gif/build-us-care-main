import { fail, ok } from "@/lib/api-response";
import { EVENT_TYPES } from "@/lib/event-types";
import { createPaymentOrderId } from "@/lib/payment-amounts";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  getProductLaborPrice,
  REPLACEMENT_PRODUCTS,
  replacementProductSnapshot,
  type ReplacementProduct
} from "@/lib/replacement-products";
import {
  createOrderInquiryMediaPath,
  isAllowedPhotoContentType,
  MAX_PHOTO_UPLOAD_BYTES,
  ORDER_PHOTOS_BUCKET
} from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREATE_LIMIT = 5;
const CREATE_WINDOW_MS = 15 * 60 * 1000;
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
  selected?: Array<{ id?: string; qty?: number }>;
  selfDisposal?: boolean;
  totals?: {
    productAmount?: number;
    laborAmount?: number;
    disposalAmount?: number;
    totalAmount?: number;
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

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
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

function productById(id: string) {
  return REPLACEMENT_PRODUCTS.find((product) => product.id === id) ?? null;
}

function selectedProducts(payload: BuildusPayload) {
  return (Array.isArray(payload.selected) ? payload.selected : [])
    .map((entry) => {
      const id = normalizeText(entry?.id);
      const product = id ? productById(id) : null;
      if (!product) return null;
      return {
        product,
        qty: Math.max(1, Math.min(20, integer(entry?.qty, 1)))
      };
    })
    .filter((entry): entry is { product: ReplacementProduct; qty: number } => Boolean(entry));
}

function displayProductName(product: ReplacementProduct) {
  return [product.brand, product.model].filter(Boolean).join(" ") || product.categoryName || product.sku;
}

function buildOrderItems(entries: Array<{ product: ReplacementProduct; qty: number }>, fallbackItem: string, submissionType: SubmissionType) {
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
        builduscare_static: true,
        request_type: "photo_check",
        inquiry_only: true
      }
    }];
  }

  return entries.map(({ product, qty }) => ({
    service_type_code: product.serviceCode,
    item_name: displayProductName(product),
    qty,
    unit_price: integer(product.price),
    options: [],
    metadata: {
      service_type_code: product.serviceCode,
      selected_replacement_product_id: product.id,
      selected_replacement_product_snapshot: replacementProductSnapshot(product),
      request_type: submissionType,
      source: "builduscare_static"
    }
  }));
}

function buildQuoteLines(entries: Array<{ product: ReplacementProduct; qty: number }>, selfDisposal: boolean) {
  return entries.map(({ product, qty }) => {
    const unitMaterial = integer(product.price);
    const unitLabor = getProductLaborPrice(product.serviceCode, product);
    const disposalPerUnit = selfDisposal ? 0 : 10000;
    const lineLabor = (unitLabor + disposalPerUnit) * qty;
    const lineMaterial = unitMaterial * qty;

    return {
      sku: product.serviceCode,
      item_name: product.categoryName || displayProductName(product),
      qty,
      unit_labor: unitLabor + disposalPerUnit,
      unit_material: unitMaterial,
      option_total: 0,
      line_labor: lineLabor,
      line_material: lineMaterial,
      line_total: lineMaterial + lineLabor,
      options: [],
      material_skus: [],
      metadata: {
        service_type_code: product.serviceCode,
        selected_replacement_product_id: product.id,
        selected_replacement_product: replacementProductSnapshot(product),
        selected_replacement_product_snapshot: replacementProductSnapshot(product),
        disposal_fee_per_unit: disposalPerUnit,
        source: "builduscare_static"
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
  const day = integer(value);
  if (day < 1 || day > 30) return null;
  return `2026-06-${String(day).padStart(2, "0")}`;
}

function timeSlot(value: string | null | undefined) {
  if (value === "오전" || value === "morning") return "morning";
  if (value === "오후" || value === "afternoon") return "afternoon";
  return null;
}

async function postJson<T>(request: Request, path: string, body: unknown): Promise<T> {
  const url = new URL(path, request.url);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": request.headers.get("user-agent") ?? "builduscare-static"
    },
    body: JSON.stringify(body)
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok) {
    const message = json?.error?.message ?? json?.message ?? `${path} request failed.`;
    throw new Error(message);
  }
  return json.data as T;
}

async function attachPhotos(orderId: string, files: File[]) {
  if (files.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const uploaded: string[] = [];
  const mediaRows: Array<Record<string, unknown>> = [];

  for (const [index, file] of files.slice(0, 12).entries()) {
    if (!isAllowedPhotoContentType(file.type)) {
      throw new Error("지원하지 않는 사진 형식이 포함되어 있습니다.");
    }
    if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
      throw new Error("사진은 장당 10MB 이하만 업로드할 수 있습니다.");
    }

    const filePath = createOrderInquiryMediaPath(orderId, file.name || `photo-${index + 1}.jpg`, file.type);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).upload(filePath, buffer, {
      contentType: file.type,
      upsert: false
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    uploaded.push(filePath);
    mediaRows.push({
      order_id: orderId,
      job_id: null,
      type: "inquiry",
      url: `storage://${ORDER_PHOTOS_BUCKET}/${filePath}`,
      file_path: filePath,
      angle: null,
      tags: ["customer", "builduscare-static"],
      sort_order: index
    });
  }

  if (mediaRows.length > 0) {
    const { error: mediaError } = await supabase.from("media").insert(mediaRows);
    if (mediaError) {
      throw new Error(mediaError.message);
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({ inquiry_photos: uploaded })
      .eq("id", orderId);
    if (orderError) {
      throw new Error(orderError.message);
    }
  }

  return uploaded;
}

async function createPhotoDiagnosis(params: {
  orderId: string;
  orderNumber: string;
  serviceCode: string;
  photoPaths: string[];
  name: string;
  phone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode: string;
  item: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("diagnoses")
    .insert({
      order_id: params.orderId,
      service_type_code: params.serviceCode,
      service_code: params.serviceCode,
      image_urls: params.photoPaths,
      photos: params.photoPaths,
      result: null,
      confidence: null,
      reason: null,
      details: "Build us Care 사진 확인 접수",
      recommendation: null,
      customer_name: params.name,
      customer_phone: params.phone,
      raw_response: {
        source: "builduscare_photo_check",
        receipt_number: params.orderNumber,
        order_number: params.orderNumber,
        order_id: params.orderId,
        service_code: params.serviceCode,
        item: params.item,
        customer: {
          name: params.name,
          phone: params.phone
        },
        address: {
          roadAddress: params.roadAddress,
          detailAddress: params.detailAddress,
          postalCode: params.postalCode,
          full: [params.roadAddress, params.detailAddress].filter(Boolean).join(" ")
        },
        photo_count: params.photoPaths.length
      },
      is_test: false
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create builduscare orders.", 500);
  }

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
      ? "builduscare 정적 화면 사진 확인 접수"
      : "builduscare 정적 화면 제품 주문 접수";
  const orderCreatePayload = {
    customer: {
      name,
      phone,
      acquisition_source: "builduscare_static"
    },
    address: {
      road_address: roadAddress,
      detail_address: detailAddress,
      postal_code: postalCode
    },
    home: {
      address_full: [roadAddress, detailAddress].filter(Boolean).join(" "),
      address_dong: "unknown",
      postal_code: postalCode,
      building_type: "unknown",
      housing_type: "unknown",
      size_pyung: 0
    },
    order: {
      channel: payload.deviceType === "mobile" ? "mobile_web" : "web",
      reason: orderReason,
      urgency: "scheduled",
      self_diagnosis: selfDiagnosis,
      skus: orderItems.map((orderItem) => ({
        sku: orderItem.service_type_code,
        qty: orderItem.qty,
        service_type: "replacement_product",
        options: orderItem.options,
        material_skus: [],
        metadata: orderItem.metadata
      }))
    },
    channel: payload.deviceType === "mobile" ? "mobile_web" : "web",
    reason: orderReason,
    urgency: "scheduled",
    service_type_code: primaryServiceCode,
    visit_fee: 0,
    special_requests:
      submissionType === "photo_check"
        ? "Build us Care 사진 확인 신청"
        : `Build us Care 제품 주문 신청${payload.selfDisposal ? " / 폐기물 직접 처리" : ""}`,
    items: orderItems
  };

  try {
    const orderResult = await postJson<{
      order: { id: string; order_number: string; access_token: string; status: string };
      customer: { id: string; name?: string | null; phone?: string | null };
    }>(request, "/api/orders", orderCreatePayload);

    const photoFiles = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const photoPaths = await attachPhotos(orderResult.order.id, photoFiles);

    const supabase = getSupabaseAdmin();
    const diagnosis =
      submissionType === "photo_check"
        ? await createPhotoDiagnosis({
            orderId: orderResult.order.id,
            orderNumber: orderResult.order.order_number,
            serviceCode: primaryServiceCode,
            photoPaths,
            name,
            phone,
            roadAddress,
            detailAddress,
            postalCode,
            item
          })
        : null;
    const reserved = reservedDate(payload.reservation?.date);
    const slot = timeSlot(payload.reservation?.time);
    if (reserved && slot) {
      await postJson(request, `/api/orders/${orderResult.order.id}/reservation`, {
        accessToken: orderResult.order.access_token,
        reserved_date: reserved,
        time_slot: slot,
        status: "pending",
        notes: "사진 확인 후 일정 확정"
      });
    }

    let quote: Record<string, unknown> | null = null;
    let payment: Record<string, unknown> | null = null;
    let transferUrl: string | null = null;

    if (entries.length > 0) {
      const quoteLines = buildQuoteLines(entries, Boolean(payload.selfDisposal));
      const totalMaterial = quoteLines.reduce((sum, line) => sum + line.line_material, 0);
      const totalLabor = quoteLines.reduce((sum, line) => sum + line.line_labor + line.option_total, 0);
      const totalFinal = totalMaterial + totalLabor;
      const now = new Date().toISOString();

      const { data: insertedQuote, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          order_id: orderResult.order.id,
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
      quote = insertedQuote;

      const providerOrderId = createPaymentOrderId();
      const { data: insertedPayment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: orderResult.order.id,
          quote_id: insertedQuote.id,
          provider: "bank_transfer",
          provider_order_id: providerOrderId,
          method: "transfer",
          order_name: orderName(quoteLines, item),
          amount: totalMaterial,
          status: totalMaterial > 0 ? "pending" : "done",
          provider_status: totalMaterial > 0 ? "WAITING_DEPOSIT" : "DONE",
          requested_at: now,
          product_amount: totalMaterial,
          service_fee_amount: totalLabor,
          total_amount: totalFinal,
          online_payment_amount: totalMaterial,
          onsite_payment_amount: totalLabor,
          onsite_payment_status: totalLabor > 0 ? "PENDING" : "DONE",
          quote_status: "pending_product_payment"
        })
        .select("*")
        .single();
      if (paymentError) throw new Error(paymentError.message);
      payment = insertedPayment;

      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({
          status: totalMaterial > 0 ? "pending_product_payment" : "inquiry",
          visit_fee: 0,
          subtotal_amount: totalMaterial + totalLabor,
          total_amount: totalFinal,
          online_payment_amount: totalMaterial,
          onsite_payment_amount: totalLabor,
          onsite_payment_status: totalLabor > 0 ? "PENDING" : "DONE"
        })
        .eq("id", orderResult.order.id);
      if (orderUpdateError) throw new Error(orderUpdateError.message);

      await supabase.from("events").insert({
        event_type: EVENT_TYPES.PAYMENT_STARTED,
        order_id: orderResult.order.id,
        customer_id: orderResult.customer.id,
        service_code: primaryServiceCode,
        properties: {
          source: "builduscare_static",
          payment_id: insertedPayment.id,
          quote_id: insertedQuote.id,
          product_amount: totalMaterial,
          service_fee_amount: totalLabor,
          total_amount: totalFinal
        }
      });

      const transferParams = new URLSearchParams({
        orderId: orderResult.order.id,
        accessToken: orderResult.order.access_token,
        amount: String(totalMaterial),
        productAmount: String(totalMaterial),
        serviceFeeAmount: String(totalLabor),
        onsiteAmount: String(totalLabor),
        totalAmount: String(totalFinal)
      });
      transferUrl = `/payment/transfer?${transferParams.toString()}`;
    }

    return ok(
      {
        order: {
          id: orderResult.order.id,
          orderNumber: orderResult.order.order_number,
          accessToken: orderResult.order.access_token,
          status: payment ? "pending_product_payment" : orderResult.order.status,
          statusUrl: `/orders/${orderResult.order.id}?accessToken=${orderResult.order.access_token}`,
          transferUrl,
          customerName: name,
          phone,
          roadAddress,
          detailAddress,
          postalCode,
          item,
          requestType: submissionType,
          selected: entries.map(({ product, qty }) => ({
            id: product.id,
            brand: product.brand,
            name: displayProductName(product),
            model: product.model,
            sku: product.sku,
            serviceCode: product.serviceCode,
            categoryName: product.categoryName,
            qty,
            price: integer(product.price)
          })),
          photoCount: photoPaths.length,
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
          quote,
          diagnosisId: diagnosis?.id ?? null
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "접수 저장에 실패했습니다.", 500);
  }
}
