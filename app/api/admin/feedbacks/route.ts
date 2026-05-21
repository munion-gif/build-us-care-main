import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/feedbacks", method: "GET", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to list feedbacks.", 500);
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");
  const rating = searchParams.get("rating");
  const npsMin = searchParams.get("nps_min");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const limit = parseBoundedInt(searchParams.get("limit"), 50, 1, 100);
  const offset = parseBoundedInt(searchParams.get("offset"), 0, 0, 10000);

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("feedbacks")
    .select(
      `
      *,
      orders (
        id,
        order_number,
        status,
        total_amount,
        created_at
      )
    `,
      { count: "exact" }
    )
    .order("submitted_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (orderId) {
    query = query.eq("order_id", orderId);
  }

  if (rating) {
    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return fail("VALIDATION_ERROR", "rating must be an integer between 1 and 5.", 400);
    }
    query = query.eq("rating", parsedRating);
  }

  if (npsMin) {
    const parsedNpsMin = Number(npsMin);
    if (!Number.isInteger(parsedNpsMin) || parsedNpsMin < 0 || parsedNpsMin > 10) {
      return fail("VALIDATION_ERROR", "nps_min must be an integer between 0 and 10.", 400);
    }
    query = query.gte("nps", parsedNpsMin);
  }

  if (dateFrom) {
    query = query.gte("submitted_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("submitted_at", dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/feedbacks", method: "GET", adminKeyId, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  logOperation({ requestId, endpoint: "/api/admin/feedbacks", method: "GET", adminKeyId, success: true });
  return ok({ feedbacks: data, pagination: { limit, offset, count: count ?? 0 } });
}
