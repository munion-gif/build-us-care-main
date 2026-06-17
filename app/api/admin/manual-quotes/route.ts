import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { formatServiceName } from "@/lib/format";
import { calculateServerQuote } from "@/lib/server-quote";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { findReplacementProduct, isProductSelectionService } from "@/lib/replacement-products";
import { uuidSchema } from "@/lib/validation";
import type { QuoteDocumentInput } from "@/lib/quote-document";

const manualQuoteItemSchema = z.object({
  service_type_code: z.string().min(1),
  product_id: z.string().min(1),
  qty: z.coerce.number().int().positive().default(1)
});

const manualQuoteSchema = z.object({
  manual_quote_id: z.string().uuid().optional().nullable(),
  service_type_code: z.string().min(1),
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().min(1),
  address_text: z.string().trim().min(1),
  visit_fee: z.coerce.number().int().min(0).default(0),
  discount: z.coerce.number().int().min(0).default(0),
  items: z.array(manualQuoteItemSchema).min(1)
});

function manualQuoteItemToInput(item: z.infer<typeof manualQuoteItemSchema>) {
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

function newQuoteNumber() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `MQ-${yyyy}${mm}${dd}-${Date.now().toString(36).toUpperCase()}`;
}

function buildManualQuoteDocumentInput(quote: any): QuoteDocumentInput {
  const rows = Array.isArray(quote.items) ? quote.items : [];
  const firstServiceCode = String(rows[0]?.metadata?.service_type_code ?? rows[0]?.sku ?? "");

  return {
    orderNumber: quote.quote_number,
    customerName: quote.customer_name,
    customerPhone: quote.customer_phone,
    serviceName: firstServiceCode || "manual_quote",
    rows: rows.map((item: any, index: number) => {
      const product = item?.metadata?.selected_replacement_product ?? {};
      return {
        id: `${item?.sku ?? "manual"}-${index}`,
        image: typeof product?.image === "string" ? product.image : null,
        productName: [product?.brand, product?.model].filter(Boolean).join(" ").trim() || item?.item_name || "선택 제품",
        sku: typeof product?.sku === "string" ? product.sku : item?.sku ?? "-",
        categoryLabel: formatServiceName(String(item?.metadata?.service_type_code ?? item?.sku ?? "")),
        qty: Number(item?.qty ?? 1),
        price: Number(item?.line_material ?? 0),
        labor: Number(item?.line_labor ?? 0) + Number(item?.option_total ?? 0),
        finalPrice: Number(item?.line_total ?? 0)
      };
    }),
    address: quote.address_text,
    visitText: "방문일 확인 중",
    productTotal: Number(quote.total_material ?? 0),
    laborTotal: Number(quote.total_labor ?? 0) + Number(quote.visit_fee ?? 0),
    finalTotal: Number(quote.total_final ?? 0),
    transferAmount: Number(quote.total_material ?? 0),
    onsiteAmount: Math.max(0, Number(quote.total_labor ?? 0) + Number(quote.visit_fee ?? 0) - Number(quote.discount ?? 0)),
    productCatalogMode: true,
    cashReceiptText: "미정"
  };
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const body = await readJson(request);
  const parsed = manualQuoteSchema.safeParse(body ?? {});
  if (!parsed.success) return validationError(parsed.error, "Invalid manual quote payload.");

  if (!hasSupabaseEnv()) {
    return fail("local_mode", "Supabase 환경이 없어 수동 견적은 브라우저 임시 저장으로 처리해야 합니다.", 409, { localMode: true });
  }

  const manualQuoteId = parsed.data.manual_quote_id ? uuidSchema.parse(parsed.data.manual_quote_id) : null;

  try {
    const supabase = getSupabaseAdmin();
    const items = parsed.data.items.map(manualQuoteItemToInput);
    const pricing = await calculateServerQuote(supabase, items, {
      visitFee: parsed.data.visit_fee,
      discount: parsed.data.discount
    });

    const row = {
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone,
      address_text: parsed.data.address_text,
      items: pricing.items,
      total_material: pricing.total_material,
      total_labor: pricing.total_labor,
      visit_fee: pricing.visit_fee,
      discount: pricing.discount,
      total_final: pricing.total_final
    };

    const query = manualQuoteId
      ? supabase
          .from("manual_quotes")
          .update(row)
          .eq("id", manualQuoteId)
          .select("*")
          .single()
      : supabase
          .from("manual_quotes")
          .insert({ ...row, quote_number: newQuoteNumber() })
          .select("*")
          .single();

    const { data: quote, error } = await query;
    if (error) throw new Error(error.message);

    return ok({
      manualQuote: quote,
      pricing,
      quoteDocumentInput: buildManualQuoteDocumentInput(quote)
    });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to save manual quote.", 500);
  }
}
