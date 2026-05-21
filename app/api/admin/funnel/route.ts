import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { EVENT_TYPES } from "@/lib/event-types";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 300;

const FUNNEL = [
  EVENT_TYPES.DIAGNOSIS_REQUESTED,
  EVENT_TYPES.QUOTE_PAGE_VIEW,
  EVENT_TYPES.ADDRESS_ENTERED,
  EVENT_TYPES.ORDER_CREATED,
  EVENT_TYPES.PAYMENT_STARTED,
  EVENT_TYPES.PAYMENT_COMPLETED
] as const;

const LABELS: Record<string, string> = {
  [EVENT_TYPES.DIAGNOSIS_REQUESTED]: "사진 판정 요청",
  [EVENT_TYPES.QUOTE_PAGE_VIEW]: "견적 페이지 진입",
  [EVENT_TYPES.ADDRESS_ENTERED]: "주소 입력 완료",
  [EVENT_TYPES.ORDER_CREATED]: "주문 생성",
  [EVENT_TYPES.PAYMENT_STARTED]: "결제 시작",
  [EVENT_TYPES.PAYMENT_COMPLETED]: "결제 완료"
};

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") === "30d" ? "30d" : "7d";
  const since = new Date(Date.now() - (period === "30d" ? 30 : 7) * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("events")
    .select("event_type,session_id,properties")
    .in("event_type", [...FUNNEL])
    .gte("occurred_at", since);

  if (error) return fail("internal_error", error.message, 500);

  const rows = data ?? [];
  const totalByType = new Map<string, Set<string>>();
  const byChannel = new Map<string, Map<string, Set<string>>>();

  for (const row of rows as any[]) {
    const session = row.session_id ?? `event:${row.event_type}:${Math.random()}`;
    const channel = row.properties?.utm_source ?? "direct";
    if (!totalByType.has(row.event_type)) totalByType.set(row.event_type, new Set());
    totalByType.get(row.event_type)?.add(session);
    if (!byChannel.has(channel)) byChannel.set(channel, new Map());
    const channelMap = byChannel.get(channel)!;
    if (!channelMap.has(row.event_type)) channelMap.set(row.event_type, new Set());
    channelMap.get(row.event_type)?.add(session);
  }

  function buildSteps(map: Map<string, Set<string>>) {
    return FUNNEL.map((eventType, index) => {
      const count = map.get(eventType)?.size ?? 0;
      const previous = index === 0 ? count : map.get(FUNNEL[index - 1])?.size ?? 0;
      return {
        eventType,
        label: LABELS[eventType],
        sessions: count,
        conversionFromPrevious: index === 0 || previous === 0 ? null : Math.round((count / previous) * 1000) / 10
      };
    });
  }

  return ok({
    period,
    steps: buildSteps(totalByType),
    channels: Object.fromEntries(Array.from(byChannel.entries()).map(([channel, map]) => [channel, buildSteps(map)]))
  });
}
