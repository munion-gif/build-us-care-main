import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { hasAdminAccess, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { accessTokenSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

const acceptQuoteSchema = z.object({
  accessToken: accessTokenSchema.optional()
});

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to accept quotes.", 500);
  }

  const { id } = await context.params;
  const quoteId = uuidSchema.safeParse(id);

  if (!quoteId.success) {
    return validationError(quoteId.error, "Invalid quote id.");
  }

  const body = await readJson(request);
  const parsed = acceptQuoteSchema.safeParse(body && typeof body === "object" ? body : {});
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid quote accept request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId.data)
    .single();

  if (quoteError || !quote) {
    return fail("not_found", "Quote not found.", 404);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,is_test,access_token")
    .eq("id", quote.order_id)
    .single();

  if (orderError || !order) {
    return fail("not_found", "Order not found.", 404);
  }

  const isGuest = parsed.data.accessToken && parsed.data.accessToken === order.access_token;
  if (!isGuest && !hasAdminAccess(request)) {
    return fail("forbidden", "A valid accessToken is required.", 403);
  }

  if (order.is_test) {
    const authError = requireAdmin(request);
    if (authError) return fail("not_found", "Quote not found.", 404);
  }

  if (quote.accepted_at) {
    return fail("conflict", "Quote has already been accepted.", 409, {
      accepted_at: quote.accepted_at
    });
  }

  const acceptedAt = new Date().toISOString();
  const { data: acceptedQuote, error: acceptError } = await supabase
    .from("quotes")
    .update({ accepted_at: acceptedAt })
    .eq("id", quoteId.data)
    .is("accepted_at", null)
    .select("*")
    .single();

  if (acceptError || !acceptedQuote) {
    return fail("conflict", "Quote has already been accepted.", 409);
  }

  await supabase
    .from("orders")
    .update({
      status: "payment_pending",
      visit_fee: acceptedQuote.visit_fee,
      subtotal_amount: acceptedQuote.total_material + acceptedQuote.total_labor,
      total_amount: acceptedQuote.total_final
    })
    .eq("id", acceptedQuote.order_id);

  return ok({ quote: acceptedQuote });
}
