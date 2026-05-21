import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { calculateQuote } from "@/lib/quote";
import { calculateServerQuote } from "@/lib/server-quote";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { quoteRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
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
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", parsed.data.order_id)
    .single();

  if (orderError || !order) {
    return fail("not_found", "Order not found.", 404);
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

  await supabase.from("events").insert({
    event_type: "quote_generated",
    order_id: parsed.data.order_id,
    properties: {
      quote_id: quote.id,
      version,
      total_final: quote.total_final
    }
  });

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
