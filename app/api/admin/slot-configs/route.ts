import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson } from "@/lib/errors";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

function datePattern(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function capValue(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.trunc(parsed), 0), 20);
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/slot-configs", method: "GET", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const supabase = getSupabaseAdmin();
  const [configsResult, capConfigResult, activeTechniciansResult] = await Promise.all([
    supabase.from("slot_configs").select("*").order("date", { ascending: true }),
    supabase.from("app_configs").select("value").eq("key", "slot_cap").maybeSingle(),
    supabase.from("technicians").select("id", { count: "exact", head: true }).eq("is_active", true)
  ]);
  const error = configsResult.error ?? capConfigResult.error ?? activeTechniciansResult.error;
  if (error) return fail("internal_error", error.message, 500);
  const manualCap = Number(capConfigResult.data?.value);
  const activeTechnicianCount = activeTechniciansResult.count ?? 0;
  const fallbackCap = Number(process.env.MAX_SLOTS_PER_PERIOD ?? 3);
  const cap =
    Number.isFinite(manualCap) && manualCap > 0
      ? Math.min(Math.max(Math.trunc(manualCap), 1), 20)
      : activeTechnicianCount > 0
        ? Math.min(Math.max(activeTechnicianCount, 1), 20)
        : fallbackCap;
  return ok({
    configs: configsResult.data?.filter((row: any) => row.type !== "cap") ?? [],
    cap,
    capSource: Number.isFinite(manualCap) && manualCap > 0 ? "manual" : activeTechnicianCount > 0 ? "active_technicians" : "fallback",
    activeTechnicianCount
  });
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/slot-configs", method: "POST", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const body = await readJson(request);
  const supabase = getSupabaseAdmin();

  if (body?.type === "cap") {
    const cap = capValue(body.cap_value);
    if (cap === null) return fail("BAD_REQUEST", "Invalid cap value.", 400);
    if (cap <= 0) {
      const [{ error: appConfigError }, { error: slotConfigError }] = await Promise.all([
        supabase.from("app_configs").delete().eq("key", "slot_cap"),
        supabase.from("slot_configs").delete().eq("type", "cap")
      ]);
      const deleteError = appConfigError ?? slotConfigError;
      if (deleteError) return fail("internal_error", deleteError.message, 500);
      return ok({ config: null, capSource: "active_technicians" });
    }
    const { data, error } = await supabase
      .from("app_configs")
      .upsert({ key: "slot_cap", value: String(cap), description: "오전/오후 각 최대 예약 건수. 비워두면 활성 기사 수 기준 자동 설정", updated_at: new Date().toISOString() }, { onConflict: "key" })
      .select("*")
      .single();
    if (error) return fail("internal_error", error.message, 500);
    return ok({ config: data });
  }

  if (!datePattern(body?.date)) return fail("BAD_REQUEST", "Invalid date.", 400);
  const reason = typeof body?.reason === "string" ? body.reason : null;
  const { data, error } = await supabase
    .from("slot_configs")
    .upsert(
      { date: body.date, type: "date", blocked: true, reason, updated_at: new Date().toISOString() },
      { onConflict: "date" }
    )
    .select("*")
    .single();

  if (error) return fail("internal_error", error.message, 500);
  return ok({ config: data });
}
