import { KAKAO_CHANNEL_URL } from "@/lib/config";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export type PublicAppConfig = {
  kakaoChannelUrl: string | null;
  servicePhone: string | null;
  maintenanceMode: boolean;
};

const DEFAULTS: PublicAppConfig = {
  kakaoChannelUrl: KAKAO_CHANNEL_URL,
  servicePhone: null,
  maintenanceMode: false
};

function normalizeNullable(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("_placeholder")) return null;
  return trimmed;
}

export async function getPublicAppConfig(): Promise<PublicAppConfig> {
  if (!hasSupabaseEnv()) return DEFAULTS;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("app_configs")
      .select("key,value")
      .in("key", ["kakao_channel_url", "service_phone", "maintenance_mode"]);

    if (error) return DEFAULTS;

    const map = new Map((data ?? []).map((item) => [item.key, item.value]));
    return {
      kakaoChannelUrl: normalizeNullable(map.get("kakao_channel_url")) ?? DEFAULTS.kakaoChannelUrl,
      servicePhone: normalizeNullable(map.get("service_phone")),
      maintenanceMode: map.get("maintenance_mode") === "true"
    };
  } catch {
    return DEFAULTS;
  }
}
