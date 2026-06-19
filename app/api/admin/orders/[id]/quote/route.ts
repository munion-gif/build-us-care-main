import { z } from "zod";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { formatServiceName } from "@/lib/format";
import { calculateServerQuote } from "@/lib/server-quote";
import { periodCapFromConfig, resolveDefaultSlotCap, type SlotPeriod } from "@/lib/slot-capacity";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { buildQuoteDocumentInputFromOrderStatus } from "@/lib/quote-document";
import { quoteSubtotalAmount, quoteVatIncludedAmount, quoteVatIncludedLaborAmount } from "@/lib/quote-totals";
import { closedReservationReason, isClosedReservationDate, minReservationDateText } from "@/lib/reservation-policy";
import {
  BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE,
  BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE,
  appendLocalAdminOrderHistory,
  localAdminOrderToAdminListItem,
  localAdminOrderToHistoryEntry,
  readLocalAdminOrderCookie,
  readLocalAdminOrderHistoryCookie,
  type LocalAdminOrderCookie
} from "@/lib/builduscare-local-admin";
import { isProductSelectionService, findReplacementProduct, getProductLaborPrice, replacementProductSnapshot } from "@/lib/replacement-products";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const adminQuoteItemSchema = z.object({
  service_type_code: z.string().min(1),
  product_id: z.string().min(1),
  qty: z.coerce.number().int().positive().default(1)
});

const adminQuoteSchema = z.object({
  service_type_code: z.string().min(1),
  customer_name: z.string().trim().optional().nullable(),
  customer_phone: z.string().trim().optional().nullable(),
  address_text: z.string().trim().optional().nullable(),
  visit_fee: z.coerce.number().int().min(0).default(0),
  discount: z.coerce.number().int().min(0).default(0),
  schedule: z.object({
    reserved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time_slot: z.enum(["morning", "afternoon"])
  }).nullable().optional(),
  items: z.array(adminQuoteItemSchema).min(1)
});

function scheduledAtForSlot(dateText: string, slot: SlotPeriod) {
  return `${dateText}T${slot === "afternoon" ? "13:00:00" : "09:00:00"}+09:00`;
}

function kstDateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function slotFromScheduledAt(value?: string | null): SlotPeriod | null {
  if (!value) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function kstDayUtcRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function activeVisitJob(jobs: any[]) {
  return jobs
    .filter((job) => job.status !== "cancelled")
    .sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

async function resolveRequestedSlotCap(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  reservedDate: string;
  timeSlot: SlotPeriod;
}) {
  const { supabase, reservedDate, timeSlot } = params;
  const [configResult, capResult] = await Promise.all([
    supabase
      .from("slot_configs")
      .select("date,morning_cap,afternoon_cap,blocked,type,cap_value")
      .eq("type", "date")
      .eq("date", reservedDate)
      .maybeSingle(),
    resolveDefaultSlotCap(supabase)
  ]);

  if (configResult.error) throw new Error(configResult.error.message);
  return {
    blocked: Boolean(configResult.data?.blocked),
    cap: periodCapFromConfig(configResult.data, timeSlot, capResult.cap),
    capSource: capResult.capSource,
    activeTechnicianCount: capResult.activeTechnicianCount
  };
}

async function assertSlotAvailable(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  orderId: string;
  reservedDate: string;
  timeSlot: SlotPeriod;
  cap: number;
}) {
  const { supabase, orderId, reservedDate, timeSlot, cap } = params;
  const range = kstDayUtcRange(reservedDate);
  const { data, error } = await supabase
    .from("jobs")
    .select("id,order_id,scheduled_at,status")
    .not("scheduled_at", "is", null)
    .neq("status", "cancelled")
    .gte("scheduled_at", range.start)
    .lt("scheduled_at", range.end);

  if (error) return fail("internal_error", error.message, 500);
  const usedCount = (data ?? []).filter((job) => job.order_id !== orderId && slotFromScheduledAt(job.scheduled_at) === timeSlot).length;
  if (usedCount >= cap) {
    return fail("SLOT_FULL", "선택한 시간대는 마감되었습니다. 다른 시간대를 선택해주세요.", 409);
  }
  return null;
}

function quoteDraftItemToInput(item: z.infer<typeof adminQuoteItemSchema>) {
  if (!isProductSelectionService(item.service_type_code)) {
    throw new Error("제품 카탈로그 기반 서비스만 견적서를 작성할 수 있습니다.");
  }

  const product = findReplacementProduct(item.service_type_code, item.product_id);
  if (!product) {
    throw new Error("선택한 제품 정보를 찾을 수 없습니다.");
  }

  return {
    service_type_code: item.service_type_code,
    item_name: `${product.brand} ${product.model}`.trim() || product.categoryName,
    qty: item.qty,
    unit_price: Number(product.price ?? 0),
    options: [],
    metadata: {
      selected_replacement_product_id: product.id,
      ...(product.serviceCode === "toilet_replace" ? { selected_toilet_product_id: product.id } : {})
    }
  };
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

function buildLocalQuote(items: z.infer<typeof adminQuoteSchema>["items"], visitFee: number, discount: number) {
  const quoteItems = items.map((item) => {
    const product = findReplacementProduct(item.service_type_code, item.product_id);
    if (!product) throw new Error("선택한 제품 정보를 찾을 수 없습니다.");
    const qty = Math.max(1, Number(item.qty ?? 1));
    const unitMaterial = quoteVatIncludedAmount(Number(product.price ?? 0));
    const unitLabor = quoteVatIncludedLaborAmount(getProductLaborPrice(item.service_type_code, product));
    const lineMaterial = unitMaterial * qty;
    const lineLabor = unitLabor * qty;
    return {
      sku: item.service_type_code,
      item_name: `${product.brand} ${product.model}`.trim() || product.categoryName,
      qty,
      unit_labor: unitLabor,
      unit_material: unitMaterial,
      option_total: 0,
      line_labor: lineLabor,
      line_material: lineMaterial,
      line_total: lineMaterial + lineLabor,
      options: [],
      material_skus: [],
      metadata: {
        service_type_code: item.service_type_code,
        selected_replacement_product_id: product.id,
        ...(product.serviceCode === "toilet_replace" ? { selected_toilet_product_id: product.id } : {}),
        selected_replacement_product: replacementProductSnapshot(product)
      }
    };
  });

  const totalMaterial = quoteItems.reduce((sum, item) => sum + Number(item.line_material ?? 0), 0);
  const totalLabor = quoteItems.reduce((sum, item) => sum + Number(item.line_labor ?? 0) + Number(item.option_total ?? 0), 0);
  const subtotalTotal = quoteSubtotalAmount(totalMaterial, totalLabor, visitFee, discount);
  const totalFinal = subtotalTotal;

  return {
    items: quoteItems,
    total_material: totalMaterial,
    total_labor: totalLabor,
    visit_fee: visitFee,
    discount,
    subtotal_total: subtotalTotal,
    total_final: totalFinal
  };
}

function updateLocalAdminOrderQuote(stored: LocalAdminOrderCookie, parsed: z.infer<typeof adminQuoteSchema>) {
  const pricing = buildLocalQuote(parsed.items, parsed.visit_fee, parsed.discount);
  const pricingOnsiteAmount = Math.max(0, pricing.total_labor + pricing.visit_fee - pricing.discount);
  const now = new Date().toISOString();
  const nextVersion = Number(stored.quote?.version ?? 0) + 1;
  const selected = parsed.items.map((item) => {
    const product = findReplacementProduct(item.service_type_code, item.product_id);
    if (!product) throw new Error("선택한 제품 정보를 찾을 수 없습니다.");
    return {
      id: product.id,
      brand: product.brand,
      name: product.model,
      model: product.model,
      image: product.image ?? "",
      sku: product.sku,
      color: product.color ?? "",
      selectedColor: product.color ?? "",
      serviceCode: product.serviceCode,
      categoryName: product.categoryName,
      qty: Number(item.qty ?? 1),
      price: Number(product.price ?? 0)
    };
  });

  const updated: LocalAdminOrderCookie = {
    ...stored,
    status: "quoted",
    customerName: parsed.customer_name?.trim() || stored.customerName,
    phone: parsed.customer_phone?.trim() || stored.phone,
    roadAddress: parsed.address_text?.trim() || stored.roadAddress,
    item: selected[0]?.name ?? stored.item,
    selected,
    totals: {
      productAmount: pricing.total_material,
      laborAmount: pricingOnsiteAmount,
      totalAmount: pricing.total_final,
      onlinePaymentAmount: pricing.total_material,
      onsitePaymentAmount: pricingOnsiteAmount
    },
    payment: {
      id: stored.payment?.id ?? `local-payment-${stored.id}`,
      status: pricing.total_material > 0 ? "pending" : "done",
      amount: pricing.total_material,
      provider: stored.payment?.provider ?? "bank_transfer"
    },
    quote: {
      id: stored.quote?.id ?? `local-quote-${stored.id}`,
      version: nextVersion,
      total_material: pricing.total_material,
      total_labor: pricing.total_labor,
      total_final: pricing.total_final,
      visit_fee: pricing.visit_fee,
      discount: pricing.discount,
      accepted_at: now,
      created_at: stored.quote?.created_at ?? now
    },
    visitFee: pricing.visit_fee,
    discount: pricing.discount,
    reservation: parsed.schedule
      ? {
          date: parsed.schedule.reserved_date,
          time: parsed.schedule.time_slot === "afternoon" ? "오후" : "오전"
        }
      : stored.reservation,
    localOnly: true
  };

  return {
    orderCookie: updated,
    order: localAdminOrderToAdminListItem(updated),
    quoteDocumentInput: {
      orderNumber: stored.orderNumber,
      customerName: parsed.customer_name?.trim() || stored.customerName,
      customerPhone: parsed.customer_phone?.trim() || stored.phone,
      serviceName: pricing.items[0]?.metadata?.service_type_code ? String(pricing.items[0].metadata.service_type_code) : parsed.service_type_code,
      rows: pricing.items.map((item, index) => {
        const product = item.metadata?.selected_replacement_product as Record<string, unknown> | undefined;
        return {
          id: `${item.sku}-${index}`,
          image: typeof product?.image === "string" ? product.image : null,
          productName: [product?.brand, product?.model].filter(Boolean).join(" ").trim() || item.item_name,
          sku: typeof product?.sku === "string" ? product.sku : item.sku,
          categoryLabel: formatServiceName(String(item.metadata?.service_type_code ?? item.sku ?? "")),
          qty: Number(item.qty ?? 1),
          price: Number(item.line_material ?? 0),
          labor: Number(item.line_labor ?? 0) + Number(item.option_total ?? 0),
          finalPrice: Number(item.line_total ?? 0)
        };
      }),
      address: [stored.roadAddress, stored.detailAddress].filter(Boolean).join(" "),
      visitText: stored.reservation?.date ? `${stored.reservation.date} ${stored.reservation.time === "afternoon" || stored.reservation.time === "오후" ? "오후" : "오전"}` : "방문일 확인 중",
      productTotal: pricing.total_material,
      laborTotal: pricing.total_labor,
      subtotalTotal: pricing.subtotal_total,
      finalTotal: pricing.total_final,
      transferAmount: pricing.total_material,
      onsiteAmount: pricingOnsiteAmount,
      productCatalogMode: pricing.total_labor > 0,
      cashReceiptText: stored.cashReceipt?.text ?? "신청 안 함"
    },
    pricing
  };
}

async function fetchOrderDetail(orderId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      service_type_code,
      special_requests,
      total_amount,
      online_payment_amount,
      onsite_payment_amount,
      visit_fee,
      customers(name,phone),
      homes(address_full),
      quotes(
        id,
        version,
        items,
        total_material,
        total_labor,
        visit_fee,
        discount,
        total_final,
        accepted_at,
        created_at
      ),
      jobs(
        id,
        status,
        scheduled_at,
        scheduled_date,
        created_at
      ),
      reservations(
        id,
        reserved_date,
        time_slot
      ),
      payments(
        id,
        status,
        provider,
        method,
        amount,
        online_payment_amount,
        onsite_payment_amount,
        total_amount,
        paid_at,
        approved_at,
        created_at
      )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function POST(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const { id } = await context.params;
  const body = await readJson(request);
  const parsed = adminQuoteSchema.safeParse(body ?? {});
  if (!parsed.success) return validationError(parsed.error, "Invalid quote payload.");

  if (!hasSupabaseEnv()) {
    const cookieHeader = request.headers.get("cookie");
    const latest = readLocalAdminOrderCookie(readCookieValue(cookieHeader, BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE));
    const history = readLocalAdminOrderHistoryCookie(readCookieValue(cookieHeader, BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE));
    const matchedHistory = history.find((item) => item.id === id);
    const matched = latest?.id === id
      ? latest
      : matchedHistory
        ? ({
            id: matchedHistory.id,
            orderNumber: matchedHistory.orderNumber,
            status: matchedHistory.status,
            customerName: matchedHistory.customerName,
            phone: matchedHistory.phone,
            roadAddress: matchedHistory.roadAddress,
            detailAddress: matchedHistory.detailAddress,
            postalCode: matchedHistory.postalCode,
            item: matchedHistory.item,
            requestType: "product_order",
            selected: [],
            photoCount: matchedHistory.photoCount,
            reservation: matchedHistory.reservation ?? null,
            totals: matchedHistory.totals ?? null,
            payment: matchedHistory.payment ?? null,
            quote: matchedHistory.quote ?? null,
            visitFee: matchedHistory.visitFee,
            discount: matchedHistory.discount,
            localOnly: true,
            createdAt: matchedHistory.createdAt
          } satisfies LocalAdminOrderCookie)
        : null;
    if (!matched) {
      return fail("not_found", "로컬 확인 모드에서 주문을 찾을 수 없습니다.", 404, { localMode: true });
    }

    try {
      const { orderCookie, order, quoteDocumentInput, pricing } = updateLocalAdminOrderQuote(matched, parsed.data);
      const nextHistory = appendLocalAdminOrderHistory(
        history,
        localAdminOrderToHistoryEntry(orderCookie)
      );
      const response = NextResponse.json({
        ok: true,
        data: {
          localMode: true,
          order,
          pricing,
          quote: orderCookie.quote,
          quoteDocumentInput
        }
      });
      if (latest?.id === id) {
        response.cookies.set(BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE, JSON.stringify(orderCookie), {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE
        });
      }
      response.cookies.set(BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE, JSON.stringify(nextHistory), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE
      });
      return response;
    } catch (error) {
      return fail("internal_error", error instanceof Error ? error.message : "로컬 견적 저장에 실패했습니다.", 500, { localMode: true });
    }
  }

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return validationError(parsedId.error, "Invalid order id.");

  try {
    const supabase = getSupabaseAdmin();
    const order = await fetchOrderDetail(parsedId.data);
    if (!order) return fail("not_found", "Order not found.", 404);

    if (parsed.data.schedule) {
      const reservedDate = parsed.data.schedule.reserved_date;
      const timeSlot = parsed.data.schedule.time_slot;

      if (reservedDate < minReservationDateText()) {
        return fail("INVALID_DATE", "제품과 일정 준비 기간 때문에 방문 일정은 영업일 기준 4일 이후 날짜부터 가능합니다.", 400);
      }
      if (isClosedReservationDate(reservedDate)) {
        return fail("SLOT_CLOSED", closedReservationReason(reservedDate), 409);
      }

      const activeJob = activeVisitJob(asArray(order.jobs));
      if (activeJob && ["in_progress", "done", "completed", "inspected"].includes(String(activeJob.status))) {
        return fail("JOB_ALREADY_STARTED", "시공이 시작된 주문은 견적 저장 화면에서 방문 일정을 변경할 수 없습니다.", 409);
      }

      const existingDate = activeJob?.scheduled_at ? kstDateOnly(activeJob.scheduled_at) : null;
      const existingSlot = activeJob?.scheduled_at ? slotFromScheduledAt(activeJob.scheduled_at) : null;
      if (existingDate !== reservedDate || existingSlot !== timeSlot) {
        const slotCap = await resolveRequestedSlotCap({ supabase, reservedDate, timeSlot });
        if (slotCap.blocked) {
          return fail("SLOT_CLOSED", "선택한 날짜는 예약이 마감되었습니다.", 409);
        }
        if (slotCap.cap <= 0) {
          return fail(
            "SLOT_UNAVAILABLE",
            slotCap.capSource === "no_active_technicians"
              ? "현재 예약 가능한 기사 일정이 없습니다. 카톡 상담으로 가능 일정을 확인해주세요."
              : "선택한 시간대는 마감되었습니다. 다른 시간대를 선택해주세요.",
            409,
            { activeTechnicianCount: slotCap.activeTechnicianCount }
          );
        }
        const slotError = await assertSlotAvailable({
          supabase,
          orderId: parsedId.data,
          reservedDate,
          timeSlot,
          cap: slotCap.cap
        });
        if (slotError) return slotError;
      }
    }

    const items = parsed.data.items.map(quoteDraftItemToInput);
    const pricing = await calculateServerQuote(supabase, items, {
      visitFee: parsed.data.visit_fee,
      discount: parsed.data.discount
    });
    const pricingOnsiteAmount = Math.max(0, pricing.total_labor + pricing.visit_fee - pricing.discount);

    const { data: latestQuote, error: latestQuoteError } = await supabase
      .from("quotes")
      .select("version")
      .eq("order_id", parsedId.data)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestQuoteError) throw new Error(latestQuoteError.message);

    const version = (latestQuote?.version ?? 0) + 1;
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        order_id: parsedId.data,
        version,
        items: pricing.items,
        total_material: pricing.total_material,
        total_labor: pricing.total_labor,
        visit_fee: pricing.visit_fee,
        discount: pricing.discount,
        total_final: pricing.total_final
      })
      .select("*")
      .single();

    if (quoteError) throw new Error(quoteError.message);

    const skuSnapshot = pricing.items.map((item) => ({
      sku: item.sku,
      qty: item.qty,
      service_type_code: item.metadata?.service_type_code ?? item.sku,
      metadata: item.metadata
    }));

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "quoted",
        service_type_code: parsed.data.service_type_code,
        skus: skuSnapshot,
        visit_fee: pricing.visit_fee,
        subtotal_amount: pricing.subtotal_total,
        total_amount: pricing.total_final,
        online_payment_amount: pricing.total_material,
        onsite_payment_amount: pricingOnsiteAmount
      })
      .eq("id", parsedId.data);

    if (updateError) throw new Error(updateError.message);

    if (parsed.data.schedule) {
      const activeJob = activeVisitJob(asArray(order.jobs));
      const nextScheduledAt = scheduledAtForSlot(parsed.data.schedule.reserved_date, parsed.data.schedule.time_slot);
      const nextJobStatus = activeJob?.status ?? "assigned";
      const scheduleMutation = activeJob
        ? supabase
            .from("jobs")
            .update({
              scheduled_at: nextScheduledAt,
              scheduled_date: parsed.data.schedule.reserved_date,
              status: nextJobStatus
            })
            .eq("id", activeJob.id)
        : supabase
            .from("jobs")
            .insert({
              order_id: parsedId.data,
              scheduled_at: nextScheduledAt,
              scheduled_date: parsed.data.schedule.reserved_date,
              status: "assigned",
              expected_minutes: 0
            });

      const { error: scheduleError } = await scheduleMutation;
      if (scheduleError) throw new Error(scheduleError.message);
    }

    const refreshedOrder = await fetchOrderDetail(parsedId.data);
    if (!refreshedOrder) throw new Error("견적 저장 후 주문 정보를 다시 불러오지 못했습니다.");

    return ok({
      quote,
      pricing,
      order: refreshedOrder,
      quoteDocumentInput: buildQuoteDocumentInputFromOrderStatus(refreshedOrder, {
        serviceName: undefined,
        fallbackTransferAmount: pricing.total_material,
        fallbackOnsiteAmount: pricingOnsiteAmount,
        fallbackTotalAmount: pricing.total_final
      })
    });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to save quote.", 500);
  }
}
