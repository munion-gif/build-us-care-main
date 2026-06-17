import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 30;

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.metadata?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

function isPhotoCheckOrder(order: any) {
  const skus = Array.isArray(order?.skus) ? order.skus : [];
  if (order?.service_type_code === "photo_inquiry" || firstServiceCode(order) === "photo_inquiry") return true;
  return skus.some((sku: any) => {
    const metadata = sku?.metadata ?? {};
    const serviceCode = sku?.service_type_code ?? metadata.service_type_code ?? sku?.sku;
    return (
      serviceCode === "photo_inquiry" ||
      metadata.inquiry_only === true ||
      metadata.request_type === "photo_check" ||
      String(sku?.item_name ?? "").includes("사진 확인")
    );
  });
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) {
    return ok({
      count: 0,
      cancelRequestedCount: 0,
      pendingDiagnosisCount: 0,
      localMode: true
    });
  }

  const supabase = getSupabaseAdmin();
  const [{ data, error }, { data: cancelRequestedRows, error: cancelCountError }, { count: pendingDiagnosisCount, error: diagnosisCountError }] = await Promise.all([
    supabase
    .from("orders")
    .select("id,service_type_code,skus,jobs(id,technician_id,status)")
      .is("deleted_at", null)
      .or("is_test.is.null,is_test.eq.false")
      .in("status", ["paid", "product_paid"]),
    supabase
      .from("orders")
      .select("id,service_type_code,skus")
      .is("deleted_at", null)
      .or("is_test.is.null,is_test.eq.false")
      .eq("status", "cancel_requested"),
    supabase
      .from("diagnoses")
      .select("id", { count: "exact", head: true })
      .or("is_test.is.null,is_test.eq.false")
      .is("result", null)
  ]);

  if (error ?? cancelCountError ?? diagnosisCountError) return fail("internal_error", (error ?? cancelCountError ?? diagnosisCountError)!.message, 500);

  const count = (data ?? []).filter((order: any) => {
    if (isPhotoCheckOrder(order)) return false;
    const jobs = Array.isArray(order.jobs) ? order.jobs : [];
    return !jobs.some((job: any) => job.technician_id && job.status !== "cancelled");
  }).length;
  const cancelRequestedCount = (cancelRequestedRows ?? []).filter((order: any) => !isPhotoCheckOrder(order)).length;

  return ok({ count, cancelRequestedCount, pendingDiagnosisCount: pendingDiagnosisCount ?? 0, localMode: false });
}
