import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const settingsSchema = z.object({
  kakao_channel_url: z.string().trim().optional(),
  service_phone: z.string().trim().optional(),
  slot_cap: z.preprocess(
    (value) => (value === "" || value === null ? 0 : value),
    z.coerce.number().int().min(0).max(20).optional()
  ),
  maintenance_mode: z.boolean().optional(),
  admin_email: z.string().trim().optional(),
  admin_phone: z.string().trim().optional(),
  notify_channel: z.enum(["email", "sms", "kakao", "none"]).optional(),
  cancel_policy_full_refund_hours: z.coerce.number().int().min(0).max(720).optional(),
  cancel_policy_full_refund_days_before: z.coerce.number().int().min(0).max(30).optional(),
  cancel_policy_partial_refund_rate: z.coerce.number().min(0).max(1).optional(),
  cancel_policy_no_refund_status: z.string().trim().optional()
});

const SETTING_KEYS = [
  "kakao_channel_url",
  "service_phone",
  "slot_cap",
  "maintenance_mode",
  "admin_email",
  "admin_phone",
  "notify_channel",
  "cancel_policy_full_refund_hours",
  "cancel_policy_full_refund_days_before",
  "cancel_policy_partial_refund_rate",
  "cancel_policy_no_refund_status"
] as const;

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { data, error } = await getSupabaseAdmin().from("app_configs").select("key,value,description,updated_at").in("key", [...SETTING_KEYS]);
  if (error) return fail("internal_error", error.message, 500);

  return ok({
    settings: Object.fromEntries((data ?? []).map((row) => [row.key, row.value]))
  });
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const parsed = settingsSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid settings request.");

  const rows = [
    parsed.data.kakao_channel_url !== undefined && {
      key: "kakao_channel_url",
      value: parsed.data.kakao_channel_url,
      description: "고객 상담 카카오 채널 URL",
      updated_at: new Date().toISOString()
    },
    parsed.data.service_phone !== undefined && {
      key: "service_phone",
      value: parsed.data.service_phone,
      description: "대표 상담 전화번호",
      updated_at: new Date().toISOString()
    },
    parsed.data.slot_cap !== undefined && parsed.data.slot_cap > 0 && {
      key: "slot_cap",
      value: String(parsed.data.slot_cap),
      description: "오전/오후 각 최대 예약 건수. 비워두면 활성 기사 수 기준 자동 설정",
      updated_at: new Date().toISOString()
    },
    parsed.data.maintenance_mode !== undefined && {
      key: "maintenance_mode",
      value: parsed.data.maintenance_mode ? "true" : "false",
      description: "true이면 홈에 점검 안내 표시",
      updated_at: new Date().toISOString()
    },
    parsed.data.admin_email !== undefined && {
      key: "admin_email",
      value: parsed.data.admin_email,
      description: "관리자 이메일 알림 수신 주소",
      updated_at: new Date().toISOString()
    },
    parsed.data.admin_phone !== undefined && {
      key: "admin_phone",
      value: parsed.data.admin_phone,
      description: "관리자 SMS 알림 수신 번호",
      updated_at: new Date().toISOString()
    },
    parsed.data.notify_channel !== undefined && {
      key: "notify_channel",
      value: parsed.data.notify_channel,
      description: "관리자 알림 방식",
      updated_at: new Date().toISOString()
    },
    parsed.data.cancel_policy_full_refund_hours !== undefined && {
      key: "cancel_policy_full_refund_hours",
      value: String(parsed.data.cancel_policy_full_refund_hours),
      description: "전액 환불 기준 결제 후 경과 시간",
      updated_at: new Date().toISOString()
    },
    parsed.data.cancel_policy_full_refund_days_before !== undefined && {
      key: "cancel_policy_full_refund_days_before",
      value: String(parsed.data.cancel_policy_full_refund_days_before),
      description: "전액 환불 기준 방문 전 남은 일수",
      updated_at: new Date().toISOString()
    },
    parsed.data.cancel_policy_partial_refund_rate !== undefined && {
      key: "cancel_policy_partial_refund_rate",
      value: String(parsed.data.cancel_policy_partial_refund_rate),
      description: "부분 환불 비율",
      updated_at: new Date().toISOString()
    },
    parsed.data.cancel_policy_no_refund_status !== undefined && {
      key: "cancel_policy_no_refund_status",
      value: parsed.data.cancel_policy_no_refund_status,
      description: "고객 직접 취소 불가 주문 상태",
      updated_at: new Date().toISOString()
    }
  ].filter(Boolean);

  const supabase = getSupabaseAdmin();
  if (rows.length > 0) {
    const { error } = await supabase.from("app_configs").upsert(rows, { onConflict: "key" });
    if (error) return fail("internal_error", error.message, 500);
  }

  if (parsed.data.slot_cap !== undefined) {
    const cap = parsed.data.slot_cap;
    if (cap <= 0) {
      const [{ error: appConfigError }, { error: slotConfigError }] = await Promise.all([
        supabase.from("app_configs").delete().eq("key", "slot_cap"),
        supabase.from("slot_configs").delete().eq("type", "cap")
      ]);
      if (appConfigError ?? slotConfigError) return fail("internal_error", (appConfigError ?? slotConfigError)!.message, 500);
    }
  }

  if (rows.length === 0 && parsed.data.slot_cap === undefined) return fail("BAD_REQUEST", "No settings to update.", 400);

  return ok({ updated: true });
}
