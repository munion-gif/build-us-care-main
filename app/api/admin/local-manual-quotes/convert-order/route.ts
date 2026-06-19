import { z } from "zod";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { createOrderNumber } from "@/lib/orders";
import {
  BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE,
  BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE,
  appendLocalAdminOrderHistory,
  localAdminOrderToHistoryEntry,
  readLocalAdminOrderHistoryCookie,
  type LocalAdminOrderCookie
} from "@/lib/builduscare-local-admin";
import { findReplacementProduct, getProductLaborPrice, replacementProductSnapshot } from "@/lib/replacement-products";
import { hasSupabaseEnv } from "@/lib/supabase";
import { quoteSubtotalAmount, quoteVatIncludedAmount } from "@/lib/quote-totals";

const localDraftItemSchema = z.object({
  service_type_code: z.string().min(1),
  product_id: z.string().min(1),
  qty: z.coerce.number().int().positive().default(1)
});

const localDraftSchema = z.object({
  id: z.string().min(1),
  customerName: z.string().trim().min(1),
  customerPhone: z.string().trim().min(1),
  addressText: z.string().trim().min(1),
  items: z.array(localDraftItemSchema).min(1),
  visitFee: z.coerce.number().int().min(0).default(0),
  discount: z.coerce.number().int().min(0).default(0)
});

function readCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) return null;
  const entries = cookieHeader.split(/;\s*/);
  for (const entry of entries) {
    const [name, ...rest] = entry.split("=");
    if (name === cookieName) return rest.join("=");
  }
  return null;
}

function buildLocalQuote(items: z.infer<typeof localDraftSchema>["items"], visitFee: number, discount: number) {
  const quoteItems = items.map((item) => {
    const product = findReplacementProduct(item.service_type_code, item.product_id);
    if (!product) throw new Error("선택한 제품 정보를 찾을 수 없습니다.");

    const qty = Math.max(1, Number(item.qty ?? 1));
    const unitMaterial = Number(product.price ?? 0);
    const unitLabor = getProductLaborPrice(item.service_type_code, product);
    const lineMaterial = unitMaterial * qty;
    const lineLabor = unitLabor * qty;

    return {
      sku: item.service_type_code,
      service_type_code: item.service_type_code,
      item_name: `${product.brand} ${product.model}`.trim() || product.categoryName,
      qty,
      unit_material: unitMaterial,
      unit_labor: unitLabor,
      option_total: 0,
      line_material: lineMaterial,
      line_labor: lineLabor,
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
  const totalLabor = quoteItems.reduce((sum, item) => sum + Number(item.line_labor ?? 0), 0);
  const subtotalTotal = quoteSubtotalAmount(totalMaterial, totalLabor, visitFee, discount);
  const totalFinal = quoteVatIncludedAmount(subtotalTotal);

  return { quoteItems, totalMaterial, totalLabor, subtotalTotal, totalFinal };
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (hasSupabaseEnv()) {
    return fail("not_local_mode", "운영 환경에서는 manual_quotes 전환 API를 사용해야 합니다.", 409);
  }

  const body = await readJson(request);
  const parsed = localDraftSchema.safeParse(body ?? {});
  if (!parsed.success) return validationError(parsed.error, "Invalid local manual quote payload.");

  try {
    const draft = parsed.data;
    const { quoteItems, totalMaterial, totalLabor, totalFinal } = buildLocalQuote(draft.items, draft.visitFee, draft.discount);
    const firstProduct = findReplacementProduct(draft.items[0].service_type_code, draft.items[0].product_id);
    const now = new Date().toISOString();
    const orderId = `local-order-${draft.id}`;
    const orderCookie: LocalAdminOrderCookie = {
      id: orderId,
      orderNumber: createOrderNumber(),
      status: totalMaterial > 0 ? "pending_product_payment" : "quoted",
      customerName: draft.customerName,
      phone: draft.customerPhone,
      roadAddress: draft.addressText,
      detailAddress: "",
      postalCode: "",
      item: firstProduct ? `${firstProduct.brand} ${firstProduct.model}`.trim() || firstProduct.categoryName : "수동 견적 제품 주문",
      requestType: "product_order",
      selected: draft.items.map((item) => {
        const product = findReplacementProduct(item.service_type_code, item.product_id);
        return {
          id: product?.id ?? item.product_id,
          brand: product?.brand ?? "",
          name: product?.model ?? "",
          model: product?.model ?? "",
          image: product?.image ?? "",
          sku: product?.sku ?? item.service_type_code,
          color: product?.color ?? "",
          selectedColor: product?.color ?? "",
          serviceCode: item.service_type_code,
          categoryName: product?.categoryName ?? "",
          qty: Number(item.qty ?? 1),
          price: Number(product?.price ?? 0)
        };
      }),
      photoCount: 0,
      reservation: null,
      totals: {
        productAmount: totalMaterial,
        laborAmount: totalLabor + draft.visitFee,
        totalAmount: totalFinal,
        onlinePaymentAmount: totalMaterial,
        onsitePaymentAmount: totalLabor + draft.visitFee
      },
      payment: {
        id: `local-payment-${orderId}`,
        status: totalMaterial > 0 ? "pending" : "done",
        amount: totalMaterial,
        provider: "bank_transfer"
      },
      cashReceipt: { text: "미정" },
      quote: {
        id: `local-quote-${orderId}`,
        version: 1,
        items: quoteItems,
        total_material: totalMaterial,
        total_labor: totalLabor,
        total_final: totalFinal,
        visit_fee: draft.visitFee,
        discount: draft.discount,
        accepted_at: now,
        created_at: now
      },
      visitFee: draft.visitFee,
      discount: draft.discount,
      localOnly: true,
      createdAt: now
    };

    const history = readLocalAdminOrderHistoryCookie(readCookieValue(request.headers.get("cookie"), BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE));
    const nextHistory = appendLocalAdminOrderHistory(history, localAdminOrderToHistoryEntry(orderCookie));
    const response = NextResponse.json({ ok: true, data: { orderId, orderNumber: orderCookie.orderNumber, localMode: true } });
    response.cookies.set(BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE, JSON.stringify(orderCookie), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE
    });
    response.cookies.set(BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE, JSON.stringify(nextHistory), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: BUILDUSCARE_LOCAL_ADMIN_COOKIE_MAX_AGE
    });
    return response;
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "로컬 제품 주문 전환에 실패했습니다.", 500, { localMode: true });
  }
}
