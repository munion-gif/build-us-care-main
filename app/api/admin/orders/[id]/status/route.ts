import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { ORDER_TRANSITIONS, canTransitionOrder } from "@/lib/status";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import type { OrderStatus } from "@/lib/types";
import { orderStatusPatchSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/orders/:id/status", method: "PATCH", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to update order status.", 500);
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const body = await readJson(request);
  const parsed = orderStatusPatchSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid order status request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId.data)
    .single();

  if (readError || !order) {
    logOperation({ requestId, endpoint: "/api/admin/orders/:id/status", method: "PATCH", adminKeyId, identifiers: { order_id: orderId.data }, success: false, errorCode: "NOT_FOUND" });
    return fail("not_found", "Order not found.", 404);
  }

  if (!canTransitionOrder(order.status as OrderStatus, parsed.data.status)) {
    logOperation({ requestId, endpoint: "/api/admin/orders/:id/status", method: "PATCH", adminKeyId, identifiers: { order_id: orderId.data }, success: false, errorCode: "INVALID_TRANSITION" });
    const allowed = ORDER_TRANSITIONS[order.status as OrderStatus] ?? [];
    return fail("conflict", `Invalid transition from ${order.status} to ${parsed.data.status}. Allowed: ${allowed.join(", ") || "none"}.`, 409);
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", orderId.data)
    .select("*")
    .single();

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/orders/:id/status", method: "PATCH", adminKeyId, identifiers: { order_id: orderId.data }, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  logOperation({ requestId, endpoint: "/api/admin/orders/:id/status", method: "PATCH", adminKeyId, identifiers: { order_id: orderId.data }, success: true });
  return ok({ order: data });
}
