import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson } from "@/lib/errors";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { resolveDefaultSlotCap } from "@/lib/slot-capacity";
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
  if (!hasSupabaseEnv()) {
    return ok({
      configs: [],
      cap: 3,
      capSource: "local_mock",
      activeTechnicianCount: 0,
      localMode: true
    });
  }

  const supabase = getSupabaseAdmin();
  let configsResult: any;
  let capResult: Awaited<ReturnType<typeof resolveDefaultSlotCap>>;

  try {
    [configsResult, capResult] = await Promise.all([
      supabase.from("slot_configs").select("*").order("date", { ascending: true }),
      resolveDefaultSlotCap(supabase)
    ]);
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to resolve slot capacity.", 500);
  }

  const error = configsResult.error;
  if (error) return fail("internal_error", error.message, 500);
  return ok({
    configs: configsResult.data?.filter((row: any) => row.type !== "cap") ?? [],
    cap: capResult.cap,
    capSource: capResult.capSource,
    activeTechnicianCount: capResult.activeTechnicianCount,
    localMode: false
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
  if (!hasSupabaseEnv()) return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 일정 설정을 저장하지 않습니다.", 409, { localMode: true });

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
      const nextCap = await resolveDefaultSlotCap(supabase);
      return ok({ config: null, cap: nextCap.cap, capSource: nextCap.capSource, activeTechnicianCount: nextCap.activeTechnicianCount });
    }
    const { data, error } = await supabase
      .from("app_configs")
      .upsert({ key: "slot_cap", value: String(cap), description: "오전/오후 각 최대 방문 건수. 비워두면 활성 기사 수 기준 자동 설정", updated_at: new Date().toISOString() }, { onConflict: "key" })
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
