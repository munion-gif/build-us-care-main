import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { EVENT_TYPES } from "@/lib/event-types";
import { readJson, validationError } from "@/lib/errors";
import { createOrderDateKey, createOrderNumber } from "@/lib/orders";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const DIAGNOSIS_CREATE_LIMIT = 5;
const DIAGNOSIS_CREATE_WINDOW_MS = 10 * 60 * 1000;

const createDiagnosisSchema = z
  .object({
    orderId: z.string().uuid().nullable().optional(),
    imageUrls: z.array(z.string().min(1)).min(1).max(3).optional(),
    serviceTypeCode: z.string().min(1).optional(),
    service_code: z.string().min(1).optional(),
    photos: z.array(z.string().min(1)).min(1).max(3).optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    address: z.string().max(300).optional(),
    serviceAreaConfirmed: z.boolean().optional(),
    customerInfoConsent: z.boolean().optional(),
    requestDetail: z.string().max(800).optional(),
    requestMessage: z.string().max(800).optional()
  })
  .strict();

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function resolveImageUrls(inputs: string[]) {
  const supabase = getSupabaseAdmin();
  const urls: string[] = [];

  for (const input of inputs) {
    if (isRemoteUrl(input)) {
      urls.push(input);
      continue;
    }

    const { data, error } = await supabase.storage
      .from(ORDER_PHOTOS_BUCKET)
      .createSignedUrl(input, ORDER_PHOTO_VIEW_EXPIRES_IN);

    if (error || !data?.signedUrl) {
      throw new Error("IMAGE_URL_UNREADABLE");
    }

    urls.push(data.signedUrl);
  }

  return urls;
}

async function createPhotoReceiptNumber(supabase: SupabaseAdmin) {
  const now = new Date();
  const dateKey = createOrderDateKey(now);
  const start = new Date(`${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const { count, error } = await supabase
    .from("diagnoses")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) throw new Error(error.message);
  return createOrderNumber(now, (count ?? 0) + 1);
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create diagnoses.", 500);
  }

  const body = await readJson(request);
  const parsed = createDiagnosisSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid diagnosis request.");
  }

  const rateLimitPhone = parsed.data.phone?.replace(/\D/g, "") || "anonymous";
  const rateLimit = checkRateLimit(`diagnosis-create:${getClientIp(request.headers)}:${rateLimitPhone}`, {
    limit: DIAGNOSIS_CREATE_LIMIT,
    windowMs: DIAGNOSIS_CREATE_WINDOW_MS
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "사진 확인 접수 요청이 많습니다. 잠시 후 다시 시도해주세요.");
  }

  const serviceTypeCode = parsed.data.serviceTypeCode ?? parsed.data.service_code ?? "toilet_replace";
  const inputImages = parsed.data.imageUrls ?? parsed.data.photos ?? [];
  const requestDetail = (parsed.data.requestDetail ?? parsed.data.requestMessage ?? "").trim();
  const address = parsed.data.address?.trim() || null;
  const serviceAreaConfirmed = parsed.data.serviceAreaConfirmed === true;
  const customerInfoConsent = parsed.data.customerInfoConsent === true;
  const detailLines = [
    requestDetail ? `고객 요청: ${requestDetail}` : null,
    address ? `주소: ${address}` : null,
    parsed.data.serviceAreaConfirmed !== undefined ? `작업 가능 지역 확인: ${serviceAreaConfirmed ? "확인함" : "미확인"}` : null,
    parsed.data.customerInfoConsent !== undefined ? `개인정보 수집·이용 동의: ${customerInfoConsent ? "확인함" : "미확인"}` : null
  ].filter(Boolean);

  if (inputImages.length === 0) {
    return fail("IMAGE_REQUIRED", "이미지를 1장 이상 업로드해주세요.", 400);
  }

  let resolvedUrls: string[];

  try {
    resolvedUrls = await resolveImageUrls(inputImages);
  } catch {
    return fail("IMAGE_UNREADABLE", "이미지를 불러올 수 없습니다. 다시 업로드해주세요.", 400);
  }

  const supabase = getSupabaseAdmin();
  let photoReceiptNumber: string | null = null;

  if (!parsed.data.orderId) {
    try {
      photoReceiptNumber = await createPhotoReceiptNumber(supabase);
    } catch (error) {
      return fail("internal_error", error instanceof Error ? error.message : "Failed to create photo receipt number.", 500);
    }
  }

  const linkedOrderId = parsed.data.orderId ?? null;
  const diagnosisInsert = {
    order_id: linkedOrderId,
    customer_name: parsed.data.name?.trim() || null,
    customer_phone: parsed.data.phone?.replace(/\D/g, "") || null,
    service_code: serviceTypeCode,
    service_type_code: serviceTypeCode,
    photos: inputImages,
    image_urls: resolvedUrls,
    result: null,
    confidence: null,
    result_message: "사진 확인 접수가 완료됐습니다.",
    reason: "담당자가 사진과 연락처를 확인할 예정입니다.",
    details: detailLines.length > 0 ? detailLines.join("\n") : "호환 가능한 제품과 견적 가능 여부를 확인한 뒤 안내합니다.",
    recommendation: "확인 후 카톡 또는 전화로 안내드릴게요.",
    suggested_service_code: null,
    raw_response: {
      mode: "manual_photo_consultation",
      customer: {
        name: parsed.data.name?.trim() || null,
        phone: parsed.data.phone?.replace(/\D/g, "") || null,
        address,
        service_area_confirmed: serviceAreaConfirmed,
        customer_info_consent: customerInfoConsent
      },
      request_detail: requestDetail || null,
      address,
      service_area_confirmed: serviceAreaConfirmed,
      customer_info_consent: customerInfoConsent,
      order_id: linkedOrderId,
      order_number: photoReceiptNumber,
      receipt_number: photoReceiptNumber
    }
  };

  let diagnosisResult = await supabase
    .from("diagnoses")
    .insert(diagnosisInsert)
    .select("*")
    .single();

  if (diagnosisResult.error && /customer_(name|phone)/i.test(diagnosisResult.error.message)) {
    const { customer_name: _customerName, customer_phone: _customerPhone, ...legacyInsert } = diagnosisInsert;
    diagnosisResult = await supabase
      .from("diagnoses")
      .insert(legacyInsert)
      .select("*")
      .single();
  }

  const { data, error } = diagnosisResult;

  if (error || !data) {
    return fail("internal_error", error?.message ?? "Failed to create diagnosis.", 500);
  }

  await supabase.from("events").insert({
    event_type: EVENT_TYPES.DIAGNOSIS_REQUESTED,
    order_id: linkedOrderId,
    session_id: null,
    properties: {
      diagnosis_id: data.id,
      order_number: photoReceiptNumber,
      receipt_number: photoReceiptNumber,
      service_code: serviceTypeCode,
      result: data.result,
      confidence: Number(data.confidence ?? 0),
      source: "api"
    }
  });

  try {
    await supabase.from("notifications").insert({
      order_id: linkedOrderId,
      channel: "admin",
      template_code: "photo_check_received",
      recipient: "admin",
      send_status: "queued",
      payload: {
        message: `[빌드어스] 사진 확인 접수\n접수번호: ${photoReceiptNumber ?? "-"}\n고객명: ${parsed.data.name?.trim() || "-"}\n연락처: ${parsed.data.phone?.replace(/\D/g, "") || "-"}\n주소: ${address ?? "-"}\n작업 가능 지역 확인: ${parsed.data.serviceAreaConfirmed === undefined ? "-" : serviceAreaConfirmed ? "확인함" : "미확인"}\n개인정보 수집·이용 동의: ${parsed.data.customerInfoConsent === undefined ? "-" : customerInfoConsent ? "확인함" : "미확인"}\n서비스: ${serviceTypeCode}\n수리내용: ${requestDetail || "-"}`,
        diagnosis_id: data.id,
        order_id: linkedOrderId,
        order_number: photoReceiptNumber,
        receipt_number: photoReceiptNumber,
        service_code: serviceTypeCode,
        request_detail: requestDetail || null,
        address,
        service_area_confirmed: serviceAreaConfirmed,
        customer_info_consent: customerInfoConsent,
        photos: inputImages,
        image_urls: resolvedUrls
      }
    });
  } catch {
    // Notification failures should not block customer submission.
  }

  return ok(
    {
      id: data.id,
      result: data.result,
      confidence: Number(data.confidence ?? 0),
      reason: data.reason,
      details: data.details,
      recommendation: data.recommendation,
      diagnosisId: data.id,
      orderId: linkedOrderId,
      orderNumber: photoReceiptNumber,
      receiptNumber: photoReceiptNumber,
      diagnosis: data,
      message: "사진 확인 접수가 완료됐어요."
    }
  );
}
