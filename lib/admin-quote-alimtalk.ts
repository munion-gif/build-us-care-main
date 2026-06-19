import { formatServiceName } from "@/lib/format";
import { buildManualQuoteDocumentInput } from "@/lib/manual-quote-document";
import { sendQuoteAlimtalk } from "@/lib/solapi-alimtalk";
import { getSupabaseAdmin } from "@/lib/supabase";

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function customerPhone(order: any) {
  const customer = Array.isArray(order?.customers) ? order.customers[0] : order?.customers;
  return customer?.phone ?? "";
}

function latestQuote(order: any) {
  return asArray(order?.quotes)
    .sort((a: any, b: any) => String(b?.accepted_at ?? b?.created_at ?? "").localeCompare(String(a?.accepted_at ?? a?.created_at ?? "")))[0] ?? null;
}

function productLabel(line: any) {
  const metadata = line?.metadata ?? {};
  const product = metadata.selected_replacement_product_snapshot ?? metadata.selected_replacement_product ?? {};
  return [product?.brand, product?.model].filter(Boolean).join(" ").trim() ||
    product?.name ||
    product?.categoryName ||
    line?.item_name ||
    formatServiceName(line?.sku);
}

function quoteItemSummary(order: any) {
  const items = asArray(latestQuote(order)?.items);
  if (items.length > 0) {
    const first = items[0];
    const label = productLabel(first);
    return items.length > 1 ? `${label} 외 ${items.length - 1}건` : label;
  }

  const skus = Array.isArray(order?.skus) ? order.skus : [];
  const first = skus[0];
  const label = first?.item_name || formatServiceName(first?.service_type_code ?? first?.sku ?? order?.service_type_code);
  return skus.length > 1 ? `${label} 외 ${skus.length - 1}건` : label;
}

export async function fetchOrderForQuoteAlimtalk(orderId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(`
      id,
      order_number,
      access_token,
      service_type_code,
      skus,
      customers(name,phone),
      quotes(
        id,
        version,
        items,
        total_final,
        accepted_at,
        created_at
      )
    `)
    .eq("id", orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

function manualQuoteItemSummary(quote: any) {
  const items = asArray(quote?.items);
  if (items.length === 0) return "예상 견적서";
  const first = items[0];
  const product = first?.metadata?.selected_replacement_product_snapshot ?? first?.metadata?.selected_replacement_product ?? {};
  const label = [product?.brand, product?.model].filter(Boolean).join(" ").trim() ||
    product?.name ||
    product?.categoryName ||
    first?.item_name ||
    formatServiceName(first?.sku);
  return items.length > 1 ? `${label} 외 ${items.length - 1}건` : label;
}

export async function fetchManualQuoteForQuoteAlimtalk(quoteId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("manual_quotes")
    .select(`
      id,
      quote_number,
      customer_name,
      customer_phone,
      address_text,
      items,
      total_material,
      total_labor,
      visit_fee,
      discount,
      total_final,
      reserved_date,
      time_slot,
      public_access_token,
      created_at,
      updated_at
    `)
    .eq("id", quoteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function sendOrderQuoteAlimtalk(orderId: string) {
  const order = await fetchOrderForQuoteAlimtalk(orderId);
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "주문을 찾을 수 없습니다." };
  }
  if (!latestQuote(order)) {
    return { ok: false, status: 409, code: "quote_required", message: "견적서를 먼저 저장한 뒤 알림톡을 발송해주세요." };
  }
  if (!order.access_token) {
    return { ok: false, status: 409, code: "missing_access_token", message: "고객 견적서 링크에 필요한 접근토큰이 없습니다." };
  }

  const itemSummary = quoteItemSummary(order);
  const result = await sendQuoteAlimtalk({
    to: customerPhone(order),
    itemSummary,
    orderId: order.id,
    accessToken: order.access_token
  });

  if (!result.ok) {
    return {
      ok: false,
      status: 502,
      code: "alimtalk_failed",
      message: result.error ?? "카카오 알림톡 발송에 실패했습니다.",
      providerResponse: result.providerResponse
    };
  }

  return {
    ok: true,
    status: 200,
    orderId: order.id,
    orderNumber: order.order_number,
    itemSummary,
    providerResponse: result.providerResponse
  };
}

export async function sendManualQuoteAlimtalk(quoteId: string) {
  const quote = await fetchManualQuoteForQuoteAlimtalk(quoteId);
  if (!quote) {
    return { ok: false, status: 404, code: "not_found", message: "수동 견적을 찾을 수 없습니다." };
  }
  if (!quote.public_access_token) {
    return { ok: false, status: 409, code: "missing_access_token", message: "견적서 공개 링크에 필요한 접근토큰이 없습니다. manual_quotes migration을 적용해주세요." };
  }

  const itemSummary = manualQuoteItemSummary(quote);
  const result = await sendQuoteAlimtalk({
    to: quote.customer_phone,
    itemSummary,
    orderId: quote.id,
    accessToken: quote.public_access_token
  });

  if (!result.ok) {
    return {
      ok: false,
      status: 502,
      code: "alimtalk_failed",
      message: result.error ?? "카카오 알림톡 발송에 실패했습니다.",
      providerResponse: result.providerResponse
    };
  }

  return {
    ok: true,
    status: 200,
    quoteId: quote.id,
    quoteNumber: quote.quote_number,
    itemSummary,
    quoteDocumentInput: buildManualQuoteDocumentInput(quote),
    providerResponse: result.providerResponse
  };
}
