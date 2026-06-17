import { fail, ok } from "@/lib/api-response";
import { parseAdminKeys } from "@/lib/admin-auth";
import { matchLocalBuildusOrderFromRequest } from "@/lib/builduscare-local-order-server";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { createWarrantyCaseSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function hasValidAdminKey(request: Request) {
  const provided = request.headers.get("x-admin-key");
  return Boolean(provided && parseAdminKeys().includes(provided));
}

function isAuthorized(orderAccessToken: string, accessToken: string | undefined, request: Request) {
  return Boolean((accessToken && accessToken === orderAccessToken) || hasValidAdminKey(request));
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const body = await readJson(request);
  const localAccessToken = typeof body?.accessToken === "string" ? body.accessToken : undefined;

  if (!hasSupabaseEnv()) {
    const localOrder = matchLocalBuildusOrderFromRequest(request, { orderId: id, accessToken: localAccessToken });
    if (localOrder) {
      return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 A/S 접수를 저장하지 않습니다.", 409, { localMode: true });
    }
    return fail("not_found", "로컬 확인 모드에서 일치하는 주문을 찾을 수 없어요.", 404, { localMode: true });
  }

  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const parsed = createWarrantyCaseSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid warranty request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,status,access_token")
    .eq("id", orderId.data)
    .maybeSingle();

  if (orderError) {
    return fail("internal_error", orderError.message, 500);
  }

  if (!order) {
    return fail("not_found", "Order not found.", 404);
  }

  if (!isAuthorized(order.access_token, parsed.data.accessToken, request)) {
    return fail("forbidden", "A valid accessToken or admin key is required.", 403);
  }

  if (order.status !== "done") {
    return fail("ORDER_NOT_COMPLETED", "A/S can be requested only after the order is done.", 400, {
      status: order.status
    });
  }

  const { data: warrantyCase, error: warrantyError } = await supabase
    .from("warranty_cases")
    .insert({
      order_id: order.id,
      job_id: null,
      status: "open",
      issue_type: parsed.data.type,
      description: parsed.data.description,
      reason: parsed.data.description,
      responsibility: null
    })
    .select("id,order_id,issue_type,description,responsibility,created_at")
    .single();

  if (warrantyError) {
    return fail("internal_error", warrantyError.message, 500);
  }

  const { error: orderUpdateError } = await supabase.from("orders").update({ status: "warranty" }).eq("id", order.id);

  if (orderUpdateError) {
    return fail("internal_error", orderUpdateError.message, 500);
  }

  return ok(
    {
      id: warrantyCase.id,
      order_id: warrantyCase.order_id,
      type: warrantyCase.issue_type,
      responsibility: warrantyCase.responsibility,
      created_at: warrantyCase.created_at
    },
    { status: 201 }
  );
}
