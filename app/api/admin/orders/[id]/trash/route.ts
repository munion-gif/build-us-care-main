import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

const trashSchema = z.object({
  reason: z.string().trim().max(300).optional()
}).strict();

function adminActor(request: Request) {
  return getAdminKeyId(request) ?? "admin_session";
}

async function readOrderId(context: Context) {
  const { id } = await context.params;
  return uuidSchema.safeParse(id);
}

export async function POST(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 주문을 휴지통으로 이동하지 않습니다.", 409, { localMode: true });

  const orderId = await readOrderId(context);
  if (!orderId.success) return validationError(orderId.error, "Invalid order id.");

  const parsed = trashSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "삭제 메모를 다시 확인해주세요.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: adminActor(request),
      deleted_reason: parsed.data.reason || null
    })
    .eq("id", orderId.data)
    .is("deleted_at", null)
    .select("id,order_number,deleted_at")
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500);
  if (!data) return fail("not_found", "활성 주문을 찾을 수 없습니다.", 404);
  return ok({ order: data });
}

export async function PATCH(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 주문 복구를 처리하지 않습니다.", 409, { localMode: true });

  const orderId = await readOrderId(context);
  if (!orderId.success) return validationError(orderId.error, "Invalid order id.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .update({
      deleted_at: null,
      deleted_by: null,
      deleted_reason: null
    })
    .eq("id", orderId.data)
    .not("deleted_at", "is", null)
    .select("id,order_number")
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500);
  if (!data) return fail("not_found", "휴지통 주문을 찾을 수 없습니다.", 404);
  return ok({ order: data });
}

export async function DELETE(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 주문 영구 삭제를 처리하지 않습니다.", 409, { localMode: true });

  const orderId = await readOrderId(context);
  if (!orderId.success) return validationError(orderId.error, "Invalid order id.");

  const supabase = getSupabaseAdmin();
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id,order_number,customer_id,home_id,deleted_at")
    .eq("id", orderId.data)
    .maybeSingle();

  if (readError) return fail("internal_error", readError.message, 500);
  if (!order) return fail("not_found", "주문을 찾을 수 없습니다.", 404);
  if (!order.deleted_at) return fail("ORDER_NOT_IN_TRASH", "휴지통으로 이동한 주문만 완전 삭제할 수 있습니다.", 409);

  const { data: payments } = await supabase.from("payments").select("id").eq("order_id", order.id);
  const paymentIds = (payments ?? []).map((payment) => payment.id);
  if (paymentIds.length > 0) {
    await supabase.from("payment_events").delete().in("payment_id", paymentIds);
  }

  await supabase.from("events").delete().eq("order_id", order.id);
  await supabase.from("sessions").delete().eq("order_id", order.id);
  await supabase.from("diagnoses").delete().eq("order_id", order.id);
  await supabase.from("warranty_cases").delete().eq("order_id", order.id);

  const { error: deleteError } = await supabase.from("orders").delete().eq("id", order.id).not("deleted_at", "is", null);
  if (deleteError) return fail("internal_error", deleteError.message, 500);

  if (order.home_id) {
    const { count: homeOrderCount } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("home_id", order.home_id);
    if ((homeOrderCount ?? 0) === 0) await supabase.from("homes").delete().eq("id", order.home_id);
  }

  if (order.customer_id) {
    const { count: customerOrderCount } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", order.customer_id);
    if ((customerOrderCount ?? 0) === 0) {
      await supabase.from("homes").delete().eq("customer_id", order.customer_id);
      await supabase.from("customers").delete().eq("id", order.customer_id);
    }
  }

  return ok({ deleted: true, orderId: order.id, orderNumber: order.order_number });
}
