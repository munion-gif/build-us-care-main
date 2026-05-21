import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { reviewSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create reviews.", 500);
  }

  const body = await readJson(request);
  const parsed = reviewSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid review request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from("orders")
    .select("id,status")
    .eq("id", parsed.data.order_id)
    .eq("access_token", parsed.data.access_token)
    .single();

  if (!order) {
    return fail("not_found", "Order not found or access token is invalid.", 404);
  }

  if (!["paid", "completed", "done"].includes(order.status)) {
    return fail("ORDER_NOT_ELIGIBLE", "Feedback can be submitted only after payment or completion.", 400, {
      status: order.status
    });
  }

  const { data: existing } = await supabase
    .from("feedbacks")
    .select("id")
    .eq("order_id", parsed.data.order_id)
    .maybeSingle();

  if (existing) {
    return fail("ALREADY_SUBMITTED", "Feedback was already submitted for this order.", 409);
  }

  const nps = parsed.data.rating >= 5 ? 10 : parsed.data.rating === 4 ? 8 : parsed.data.rating === 3 ? 6 : parsed.data.rating === 2 ? 3 : 0;
  const { data, error } = await supabase
    .from("feedbacks")
    .insert({
      order_id: parsed.data.order_id,
      rating: parsed.data.rating,
      nps,
      comment: parsed.data.comment ?? null,
      categories: { quality: parsed.data.rating },
      score_quality: parsed.data.rating,
      free_text: parsed.data.comment ?? null,
      would_recommend: parsed.data.rating >= 4,
      submitted_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) {
    return fail("conflict", error.message, 409);
  }

  return ok({ review: data, feedback: data }, { status: 201 });
}
