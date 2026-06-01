import { EVENT_TYPES } from "@/lib/event-types";

export const ADMIN_FUNNEL_STEPS = [
  EVENT_TYPES.DIAGNOSIS_REQUESTED,
  EVENT_TYPES.QUOTE_PAGE_VIEW,
  EVENT_TYPES.ADDRESS_ENTERED,
  EVENT_TYPES.ORDER_CREATED,
  EVENT_TYPES.PAYMENT_STARTED,
  EVENT_TYPES.PAYMENT_COMPLETED
] as const;

export const ADMIN_FUNNEL_LABELS: Record<string, string> = {
  [EVENT_TYPES.DIAGNOSIS_REQUESTED]: "사진 판정 요청",
  [EVENT_TYPES.QUOTE_PAGE_VIEW]: "견적 페이지 진입",
  [EVENT_TYPES.ADDRESS_ENTERED]: "주소 입력 완료",
  [EVENT_TYPES.ORDER_CREATED]: "주문 생성",
  [EVENT_TYPES.PAYMENT_STARTED]: "결제 시작",
  [EVENT_TYPES.PAYMENT_COMPLETED]: "결제 완료"
};

export type AdminFunnelEventRow = {
  id?: string | null;
  event_type: string;
  session_id?: string | null;
  source?: string | null;
  properties?: Record<string, any> | null;
};

export type AdminFunnelStep = {
  eventType: string;
  label: string;
  sessions: number;
  conversionFromPrevious: number | null;
};

export type AdminFunnelReport = {
  steps: AdminFunnelStep[];
  channels: Record<string, AdminFunnelStep[]>;
};

function sessionKey(row: AdminFunnelEventRow, index: number) {
  return row.session_id ?? `event:${row.id ?? `${row.event_type}:${index}`}`;
}

function channelKey(row: AdminFunnelEventRow) {
  return row.properties?.utm_source ?? row.properties?.source ?? row.source ?? "direct";
}

function buildSteps(map: Map<string, Set<string>>) {
  return ADMIN_FUNNEL_STEPS.map((eventType, index) => {
    const count = map.get(eventType)?.size ?? 0;
    const previous = index === 0 ? count : map.get(ADMIN_FUNNEL_STEPS[index - 1])?.size ?? 0;
    return {
      eventType,
      label: ADMIN_FUNNEL_LABELS[eventType],
      sessions: count,
      conversionFromPrevious: index === 0 || previous === 0 ? null : Math.round((count / previous) * 1000) / 10
    };
  });
}

export function buildAdminFunnelReport(rows: AdminFunnelEventRow[]): AdminFunnelReport {
  const totalByType = new Map<string, Set<string>>();
  const byChannel = new Map<string, Map<string, Set<string>>>();
  const funnelTypes = new Set<string>(ADMIN_FUNNEL_STEPS);

  rows.forEach((row, index) => {
    if (!funnelTypes.has(row.event_type)) return;

    const session = sessionKey(row, index);
    const channel = channelKey(row);

    if (!totalByType.has(row.event_type)) totalByType.set(row.event_type, new Set());
    totalByType.get(row.event_type)?.add(session);

    if (!byChannel.has(channel)) byChannel.set(channel, new Map());
    const channelMap = byChannel.get(channel)!;
    if (!channelMap.has(row.event_type)) channelMap.set(row.event_type, new Set());
    channelMap.get(row.event_type)?.add(session);
  });

  return {
    steps: buildSteps(totalByType),
    channels: Object.fromEntries(Array.from(byChannel.entries()).map(([channel, map]) => [channel, buildSteps(map)]))
  };
}

export function findAdminFunnelStep(report: AdminFunnelReport, eventType: string) {
  return report.steps.find((step) => step.eventType === eventType);
}

export function formatAdminFunnelPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}%`;
}
