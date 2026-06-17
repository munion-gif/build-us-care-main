import { z } from "zod";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { formatServiceName } from "@/lib/format";
import { calculateServerQuote } from "@/lib/server-quote";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { buildQuoteDocumentInputFromOrderStatus } from "@/lib/quote-document";
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
import { isProductSelectionService, findReplacementProduct, replacementProductSnapshot } from "@/lib/replacement-products";
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
  items: z.array(adminQuoteItemSchema).min(1)
});

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
    const unitMaterial = Number(product.price ?? 0);
    const unitLabor = Number(
      item.service_type_code === "toilet_replace" ? 100000 :
      item.service_type_code === "basin_replace" ? 35000 :
      item.service_type_code === "faucet_replace" ? 40000 :
      item.service_type_code === "bidet_install" ? 30000 :
      item.service_type_code === "ventilator_replace" ? 98000 :
      item.service_type_code === "sash_handle" ? 11000 :
      item.service_type_code === "door_handle" ? 22000 :
      item.service_type_code === "silicone_repair" ? 7000 :
      item.service_type_code === "bath_accessory" ? 19000 : 0
    );
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
  const totalFinal = Math.max(0, totalMaterial + totalLabor + visitFee - discount);

  return {
    items: quoteItems,
    total_material: totalMaterial,
    total_labor: totalLabor,
    visit_fee: visitFee,
    discount,
    total_final: totalFinal
  };
}

function updateLocalAdminOrderQuote(stored: LocalAdminOrderCookie, parsed: z.infer<typeof adminQuoteSchema>) {
  const pricing = buildLocalQuote(parsed.items, parsed.visit_fee, parsed.discount);
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
      laborAmount: pricing.total_labor,
      totalAmount: pricing.total_final,
      onlinePaymentAmount: pricing.total_material,
      onsitePaymentAmount: pricing.total_labor
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
      finalTotal: pricing.total_final,
      transferAmount: pricing.total_material,
      onsiteAmount: pricing.total_labor,
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
        total_final,
        accepted_at,
        created_at
      ),
      jobs(
        id,
        scheduled_at,
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

    const items = parsed.data.items.map(quoteDraftItemToInput);
    const pricing = await calculateServerQuote(supabase, items, {
      visitFee: parsed.data.visit_fee,
      discount: parsed.data.discount
    });

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
        subtotal_amount: pricing.total_material + pricing.total_labor,
        total_amount: pricing.total_final,
        online_payment_amount: pricing.total_material,
        onsite_payment_amount: pricing.total_labor
      })
      .eq("id", parsedId.data);

    if (updateError) throw new Error(updateError.message);

    const refreshedOrder = await fetchOrderDetail(parsedId.data);
    if (!refreshedOrder) throw new Error("견적 저장 후 주문 정보를 다시 불러오지 못했습니다.");

    return ok({
      quote,
      pricing,
      order: refreshedOrder,
      quoteDocumentInput: buildQuoteDocumentInputFromOrderStatus(refreshedOrder, {
        serviceName: undefined,
        fallbackTransferAmount: pricing.total_material,
        fallbackOnsiteAmount: pricing.total_labor,
        fallbackTotalAmount: pricing.total_final
      })
    });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to save quote.", 500);
  }
}
