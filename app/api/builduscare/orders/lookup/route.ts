import { fail, ok } from "@/lib/api-response";
import { localBuildusOrderToLookupOrder, matchLocalBuildusOrderByLookup } from "@/lib/builduscare-local-order-server";
import { readJson } from "@/lib/errors";
import { formatServiceName } from "@/lib/format";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { REPLACEMENT_PRODUCTS, replacementProductDisplayModel } from "@/lib/replacement-products";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKUP_LIMIT = 6;
const LOOKUP_WINDOW_MS = 10 * 60 * 1000;

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function asArray(value: unknown): Record<string, any>[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, any> => Boolean(entry && typeof entry === "object")) : [];
}

function latest(rows: unknown, dateKeys: string[]) {
  return asArray(rows).sort((a, b) => {
    const av = dateKeys.map((key) => a?.[key]).find(Boolean) ?? "";
    const bv = dateKeys.map((key) => b?.[key]).find(Boolean) ?? "";
    return String(bv).localeCompare(String(av));
  })[0] ?? null;
}

function kstDateOnly(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function slotFromScheduledAt(value?: string | null) {
  if (!value) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function selectedProductsFromQuote(order: Record<string, any>) {
  const quote = latest(order.quotes, ["accepted_at", "created_at"]);
  const items = asArray(quote?.items);
  return items.map((item) => {
    const metadata = item?.metadata ?? {};
    const selected =
      metadata?.selected_replacement_product ??
      metadata?.selected_replacement_product_snapshot ??
      metadata?.selected_toilet_product;
    const selectedId = selected?.id ?? metadata?.selected_replacement_product_id ?? item?.sku;
    const selectedSku = selected?.sku ?? item?.sku;
    const selectedServiceCode = selected?.serviceCode ?? metadata?.service_type_code ?? item?.sku;
    const catalogProduct =
      REPLACEMENT_PRODUCTS.find((product) => product.id === selectedId) ??
      REPLACEMENT_PRODUCTS.find((product) => product.serviceCode === selectedServiceCode && selectedSku && product.sku === selectedSku) ??
      REPLACEMENT_PRODUCTS.find((product) => product.serviceCode === selectedServiceCode && selected?.model && replacementProductDisplayModel(product) === selected.model) ??
      null;
    const optionColor = asArray(item?.options).find((option) => option?.label === "색상")?.value;
    const selectedColor = metadata?.selected_color ?? optionColor ?? "";
    const model = selected?.model ?? (catalogProduct ? replacementProductDisplayModel(catalogProduct) : "");
    const brand = selected?.brand ?? catalogProduct?.brand ?? "";
    const baseName = [brand, model].filter(Boolean).join(" ");
    const name = baseName
      ? `${baseName}${selectedColor && !baseName.includes(selectedColor) ? ` · ${selectedColor}` : ""}`
      : item?.item_name || item?.sku;
    return {
      id: selected?.id ?? catalogProduct?.id ?? metadata?.selected_replacement_product_id ?? item?.sku,
      brand,
      name,
      model,
      image: selected?.image ?? catalogProduct?.image ?? "",
      sku: selected?.sku ?? catalogProduct?.sku ?? item?.sku,
      color: (selectedColor || selected?.color || catalogProduct?.color) ?? "",
      selectedColor,
      serviceCode: selected?.serviceCode ?? catalogProduct?.serviceCode ?? item?.sku ?? metadata?.service_type_code,
      categoryName: selected?.categoryName ?? selected?.category ?? catalogProduct?.categoryName ?? formatServiceName(metadata?.service_type_code ?? item?.sku),
      qty: Number(item?.qty ?? 1),
      price: Number(item?.unit_material ?? selected?.price ?? catalogProduct?.price ?? 0)
    };
  });
}

function compactAddress(order: Record<string, any>) {
  const home = Array.isArray(order.homes) ? order.homes[0] : order.homes;
  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const full = home?.address_full ?? customer?.address_full ?? "";
  const apt = home?.address_apt ?? customer?.address_apt ?? "";
  return { roadAddress: full, detailAddress: apt && !String(full).includes(String(apt)) ? apt : "" };
}

function cashReceiptTextFromOrder(order: Record<string, any>) {
  const text = String(order?.special_requests ?? "");
  const line = text.split(/\r?\n/).find((entry) => entry.includes("현금영수증:"));
  return line?.replace(/^.*?현금영수증:\s*/, "").trim() || "신청 안 함";
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const orderNumber = normalizeText(body?.orderNumber).toUpperCase();
  const name = normalizeText(body?.name);

  if (!orderNumber) return fail("BAD_REQUEST", "주문번호를 입력해주세요.", 400);
  if (!name) return fail("BAD_REQUEST", "예약자 성함을 입력해주세요.", 400);

  if (!hasSupabaseEnv()) {
    const localOrder = matchLocalBuildusOrderByLookup(request, { orderNumber, customerName: name });
    if (localOrder) {
      return ok({
        order: localBuildusOrderToLookupOrder(localOrder),
        message: "주문을 찾았어요.",
        localMode: true
      });
    }
    return ok({
      order: null,
      message: "로컬 저장 주문만 조회할 수 있어요.",
      localMode: true
    });
  }

  const rateLimit = checkRateLimit(`builduscare-lookup:${getClientIp(request.headers)}:${orderNumber}:${name}`, {
    limit: LOOKUP_LIMIT,
    windowMs: LOOKUP_WINDOW_MS
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "조회 요청이 많습니다. 잠시 후 다시 시도해주세요.");
  }

  const supabase = getSupabaseAdmin();
  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("id,name,phone,address_full,address_apt")
    .ilike("name", name);

  if (customerError) return fail("internal_error", customerError.message, 500);
  if (!customers?.length) {
    return ok({ order: null, message: "입력하신 정보와 일치하는 주문을 찾지 못했어요." });
  }

  const customerIds = customers.map((customer) => customer.id);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,order_number,access_token,status,created_at,service_type_code,skus,total_amount,subtotal_amount,online_payment_amount,onsite_payment_amount,inquiry_photos,special_requests,
      customers(id,name,phone,address_full,address_apt),
      homes(id,address_full,address_apt,postal_code),
      payments(id,status,provider,amount,product_amount,service_fee_amount,total_amount,online_payment_amount,onsite_payment_amount,paid_at,approved_at,created_at),
      jobs(id,status,scheduled_at,created_at),
      quotes(id,items,total_material,total_labor,total_final,accepted_at,created_at)
    `
    )
    .eq("order_number", orderNumber)
    .in("customer_id", customerIds)
    .maybeSingle();

  if (orderError) return fail("internal_error", orderError.message, 500);
  if (!order) {
    return ok({ order: null, message: "입력하신 정보와 일치하는 주문을 찾지 못했어요." });
  }

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const payment = latest(order.payments, ["paid_at", "approved_at", "created_at"]);
  const job = latest(order.jobs, ["scheduled_at", "created_at"]);
  const address = compactAddress(order);
  const selected = selectedProductsFromQuote(order);
  const productAmount = Number(payment?.product_amount ?? payment?.amount ?? order.online_payment_amount ?? 0);
  const serviceFeeAmount = Number(payment?.service_fee_amount ?? order.onsite_payment_amount ?? 0);
  const totalAmount = Number(payment?.total_amount ?? order.total_amount ?? productAmount + serviceFeeAmount);
  const transferParams = payment?.status === "pending"
    ? new URLSearchParams({
        orderId: order.id,
        accessToken: order.access_token,
        amount: String(productAmount),
        productAmount: String(productAmount),
        serviceFeeAmount: String(serviceFeeAmount),
        onsiteAmount: String(serviceFeeAmount),
        totalAmount: String(totalAmount)
      })
    : null;

  return ok({
    order: {
      id: order.id,
      orderNumber: order.order_number,
      accessToken: order.access_token,
      status: order.status,
      statusUrl: `/orders/${order.id}?accessToken=${order.access_token}`,
      transferUrl: transferParams ? `/payment/transfer?${transferParams.toString()}` : null,
      serviceName: formatServiceName(order.service_type_code),
      serviceCode: order.service_type_code,
      customerName: customer?.name ?? name,
      phone: customer?.phone ?? "",
      roadAddress: address.roadAddress,
      detailAddress: address.detailAddress,
      selected,
      cashReceipt: {
        text: cashReceiptTextFromOrder(order)
      },
      photoCount: Array.isArray(order.inquiry_photos) ? order.inquiry_photos.length : 0,
      reservation: job?.scheduled_at ? {
        date: kstDateOnly(job.scheduled_at),
        time: slotFromScheduledAt(job.scheduled_at),
        status: job.status
      } : null,
      jobStatus: job?.status ?? null,
      totals: {
        productAmount,
        laborAmount: serviceFeeAmount,
        totalAmount,
        onlinePaymentAmount: productAmount,
        onsitePaymentAmount: serviceFeeAmount
      },
      payment: payment ? {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        provider: payment.provider
      } : null
    },
    message: "주문을 찾았어요."
  });
}
