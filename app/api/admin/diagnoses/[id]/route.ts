import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import {
  BUILDUSCARE_LOCAL_ADMIN_DIAGNOSIS_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_DIAGNOSES_COOKIE,
  localAdminDiagnosisHistoryToAdminListItem,
  localAdminDiagnosisToAdminListItem,
  readLocalAdminDiagnosisCookie,
  readLocalAdminDiagnosisHistoryCookie
} from "@/lib/builduscare-local-admin";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  result: z.enum(["교체추천", "교체불필요", "보류", "현장확인필요", "replace_recommended", "replacement_recommended", "hold", "no_replacement_needed", "not_needed", "site_check_required"]),
  result_message: z.string().optional(),
  reason: z.string().optional(),
  suggested_service_code: z.string().optional()
});

function readCookieValue(request: Request, cookieName: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const entries = cookieHeader.split(/;\s*/);
  for (const entry of entries) {
    const [name, ...rest] = entry.split("=");
    if (name === cookieName) return rest.join("=");
  }
  return null;
}

export async function GET(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const { id } = await context.params;

  if (!hasSupabaseEnv()) {
    const localDiagnosis = readLocalAdminDiagnosisCookie(readCookieValue(request, BUILDUSCARE_LOCAL_ADMIN_DIAGNOSIS_COOKIE));
    if (localDiagnosis && localDiagnosis.id === id) {
      return ok({ diagnosis: localAdminDiagnosisToAdminListItem(localDiagnosis), localMode: true });
    }
    const history = readLocalAdminDiagnosisHistoryCookie(readCookieValue(request, BUILDUSCARE_LOCAL_ADMIN_DIAGNOSES_COOKIE));
    const matched = history.find((entry) => entry.id === id);
    if (matched) {
      return ok({ diagnosis: localAdminDiagnosisHistoryToAdminListItem(matched), localMode: true });
    }
    return fail("not_found", "로컬 확인 모드에서 사진확인 접수를 찾을 수 없어요.", 404, { localMode: true });
  }

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return validationError(parsedId.error, "Invalid diagnosis id.");

  const { data, error } = await getSupabaseAdmin()
    .from("diagnoses")
    .select("*,orders(*,customers(*),homes(*))")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500);
  if (!data) return fail("not_found", "Diagnosis not found.", 404);
  return ok({ diagnosis: data, localMode: false });
}

export async function PATCH(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 사진확인 판정을 저장하지 않습니다.", 409, { localMode: true });
  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return validationError(parsedId.error, "Invalid diagnosis id.");
  const body = await readJson(request);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, "Invalid diagnosis update.");
  const resultMap: Record<string, string> = {
    replacement_recommended: "replace_recommended",
    not_needed: "no_replacement_needed"
  };
  const { data, error } = await getSupabaseAdmin()
    .from("diagnoses")
    .update({ ...parsed.data, result: resultMap[parsed.data.result] ?? parsed.data.result, reviewed_by: "admin", reviewed_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .select("*")
    .single();
  if (error) return fail("internal_error", error.message, 500);
  return ok({ diagnosis: data });
}

export async function DELETE(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 사진확인 접수를 삭제하지 않습니다.", 409, { localMode: true });

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return validationError(parsedId.error, "Invalid diagnosis id.");

  const supabase = getSupabaseAdmin();
  const { data: diagnosis, error: lookupError } = await supabase
    .from("diagnoses")
    .select("id,order_id,is_test,orders(id,source,reason,service_type_code,skus)")
    .eq("id", parsedId.data)
    .single();

  if (lookupError) return fail("internal_error", lookupError.message, 500);
  if (!diagnosis) return fail("not_found", "Diagnosis not found.", 404);

  const linkedOrder = Array.isArray(diagnosis.orders) ? diagnosis.orders[0] : diagnosis.orders;
  const orderSkus = Array.isArray(linkedOrder?.skus) ? linkedOrder.skus : [];
  const isPhotoInquiryOrder = Boolean(linkedOrder) && (
    linkedOrder.source === "builduscare_photo_check" ||
    linkedOrder.source === "photo_diagnosis" ||
    linkedOrder.reason === "photo_check_request" ||
    linkedOrder.reason === "photo_diagnosis" ||
    linkedOrder.service_type_code === "photo_inquiry" ||
    orderSkus.some((sku: any) => sku?.metadata?.request_type === "photo_check" || sku?.metadata?.inquiry_only === true)
  );

  if (diagnosis.order_id && !isPhotoInquiryOrder) {
    return fail("linked_order_exists", "제품 주문에 연결된 사진확인 접수는 주문관리에서 먼저 정리해 주세요.", 409);
  }

  const { error: deleteError } = await supabase
    .from("diagnoses")
    .delete()
    .eq("id", parsedId.data);

  if (deleteError) return fail("internal_error", deleteError.message, 500);

  if (diagnosis.order_id && isPhotoInquiryOrder) {
    await supabase
      .from("orders")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: "admin_session",
        deleted_reason: "사진확인 접수 삭제"
      })
      .eq("id", diagnosis.order_id)
      .is("deleted_at", null);
  }

  return ok({ id: parsedId.data, deleted: true });
}
