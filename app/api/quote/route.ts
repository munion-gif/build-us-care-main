import { fail, ok } from "@/lib/api-response";
import { hasAdminAccess, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { calculateQuote } from "@/lib/quote";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { calculateServerQuote } from "@/lib/server-quote";
import { isLifecycleSchemaError } from "@/lib/schema-compat";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { quoteRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`quote:${getClientIp(request.headers)}`, {
    limit: 60,
    windowMs: 60_000
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "견적 요청이 많습니다. 잠시 후 다시 시도해주세요.");
  }

  const body = await readJson(request);
  const parsed = quoteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid quote request.");
  }

  if (!parsed.data.order_id) {
    return ok(calculateQuote(parsed.data.items, parsed.data.visit_fee));
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to persist quotes.", 500);
  }

  const supabase = getSupabaseAdmin();
  const orderLookup = await supabase
    .from("orders")
    .select("id,is_test,access_token")
    .eq("id", parsed.data.order_id)
    .single();
  let order: any = orderLookup.data;
  let orderError = orderLookup.error;

  if (orderError && isLifecycleSchemaError(orderError)) {
    const fallback = await supabase
      .from("orders")
      .select("id,access_token")
      .eq("id", parsed.data.order_id)
      .single();
    order = fallback.data;
    orderError = fallback.error;
  }

  if (orderError || !order) {
    return fail("not_found", "Order not found.", 404);
  }

  const isGuest = parsed.data.accessToken && parsed.data.accessToken === order.access_token;
  if (!isGuest && !hasAdminAccess(request)) {
    return fail("forbidden", "A valid accessToken is required.", 403);
  }

  if (order.is_test) {
    const authError = requireAdmin(request);
    if (authError) return fail("not_found", "Order not found.", 404);
  }

  let quoteResult;
  try {
    quoteResult = await calculateServerQuote(supabase, parsed.data.items, {
      visitFee: parsed.data.visit_fee,
      discount: parsed.data.discount
    });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Quote calculation failed.", 500);
  }

  const { data: latestQuote, error: latestQuoteError } = await supabase
    .from("quotes")
    .select("version")
    .eq("order_id", parsed.data.order_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestQuoteError) {
    return fail("internal_error", latestQuoteError.message, 500);
  }

  const version = (latestQuote?.version ?? 0) + 1;
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      order_id: parsed.data.order_id,
      version,
      items: quoteResult.items,
      total_material: quoteResult.total_material,
      total_labor: quoteResult.total_labor,
      visit_fee: quoteResult.visit_fee,
      discount: quoteResult.discount,
      total_final: quoteResult.total_final
    })
    .select("*")
    .single();

  if (quoteError) {
    return fail("internal_error", quoteError.message, 500);
  }

  if (!order.is_test) {
    await supabase.from("events").insert({
      event_type: "quote_generated",
      order_id: parsed.data.order_id,
      properties: {
        quote_id: quote.id,
        version,
        total_final: quote.total_final
      }
    });
  }

  await supabase
    .from("orders")
    .update({
      status: "quoted",
      visit_fee: quoteResult.visit_fee,
      subtotal_amount: quoteResult.total_material + quoteResult.total_labor,
      total_amount: quoteResult.total_final
    })
    .eq("id", parsed.data.order_id);

  return ok({ quote, pricing: quoteResult });
}
