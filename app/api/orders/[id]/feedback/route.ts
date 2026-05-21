import { fail, ok } from "@/lib/api-response";
import { parseAdminKeys } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { createFeedbackSchema, feedbackQuerySchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

const FEEDBACK_ELIGIBLE_ORDER_STATUSES = new Set(["paid", "completed", "done"]);

function hasValidAdminKey(request: Request) {
  const provided = request.headers.get("x-admin-key");
  return Boolean(provided && parseAdminKeys().includes(provided));
}

function mapCategoriesToLegacyScores(categories: Record<string, number | undefined>, rating: number) {
  return {
    score_time: categories.speed ?? null,
    score_quality: categories.quality ?? rating,
    score_response: categories.kindness ?? null,
    score_clean: categories.cleanliness ?? null,
    score_price: categories.price ?? null
  };
}

function isAuthorized(orderAccessToken: string, accessToken: string | undefined, request: Request) {
  return Boolean((accessToken && accessToken === orderAccessToken) || hasValidAdminKey(request));
}

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create feedback.", 500);
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const body = await readJson(request);
  if (body?.nps === undefined || body?.nps === null || body?.nps === "") {
    return fail("NPS_REQUIRED", "nps는 필수 항목입니다 (0-10)", 400);
  }

  if (typeof body.nps === "number" && (body.nps < 0 || body.nps > 10)) {
    return fail("NPS_INVALID", "nps는 0-10 사이여야 합니다", 400);
  }

  const parsed = createFeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid feedback request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from("orders")
    .select("id,status,access_token")
    .eq("id", orderId.data)
    .maybeSingle();

  if (!order) {
    return fail("not_found", "Order not found.", 404);
  }

  if (!isAuthorized(order.access_token, parsed.data.accessToken, request)) {
    return fail("forbidden", "A valid accessToken or admin key is required.", 403);
  }

  if (!FEEDBACK_ELIGIBLE_ORDER_STATUSES.has(order.status)) {
    return fail("ORDER_NOT_ELIGIBLE", "Feedback can be submitted only after payment or completion.", 400, {
      status: order.status
    });
  }

  const { data: existing } = await supabase
    .from("feedbacks")
    .select("id")
    .eq("order_id", orderId.data)
    .maybeSingle();

  if (existing) {
    return fail("ALREADY_SUBMITTED", "Feedback was already submitted for this order.", 409);
  }

  const legacyScores = mapCategoriesToLegacyScores(parsed.data.categories, parsed.data.rating);
  const scoreTime = parsed.data.score_time ?? legacyScores.score_time;
  const scoreQuality = parsed.data.score_quality ?? legacyScores.score_quality;
  const scoreResponse = parsed.data.score_response ?? legacyScores.score_response;
  const scoreClean = parsed.data.score_clean ?? legacyScores.score_clean;
  const scorePrice = parsed.data.score_price ?? legacyScores.score_price;
  const { data, error } = await supabase
    .from("feedbacks")
    .insert({
      order_id: orderId.data,
      rating: parsed.data.rating,
      nps: parsed.data.nps ?? null,
      comment: parsed.data.comment ?? null,
      categories: parsed.data.categories,
      score_time: scoreTime,
      score_quality: scoreQuality,
      score_response: scoreResponse,
      score_clean: scoreClean,
      score_price: scorePrice,
      free_text: parsed.data.comment ?? null,
      would_recommend: parsed.data.would_recommend ?? parsed.data.nps >= 9,
      would_repurchase: parsed.data.would_repurchase ?? null,
      submitted_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) {
    return fail("internal_error", error.message, 500);
  }

  return ok({ feedback: data }, { status: 201 });
}

export async function GET(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to read feedback.", 500);
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const query = feedbackQuerySchema.safeParse({
    accessToken: new URL(request.url).searchParams.get("accessToken") ?? undefined
  });

  if (!query.success) {
    return validationError(query.error, "Invalid feedback query.");
  }

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from("orders")
    .select("id,access_token")
    .eq("id", orderId.data)
    .maybeSingle();

  if (!order) {
    return fail("not_found", "Order not found.", 404);
  }

  if (!isAuthorized(order.access_token, query.data.accessToken, request)) {
    return fail("forbidden", "A valid accessToken or admin key is required.", 403);
  }

  const { data, error } = await supabase.from("feedbacks").select("*").eq("order_id", orderId.data).maybeSingle();

  if (error) {
    return fail("internal_error", error.message, 500);
  }

  if (!data) {
    return fail("not_found", "Feedback not found.", 404);
  }

  return ok({ feedback: data });
}
