import { fail, ok } from "@/lib/api-response";
import {
  boundedNumber,
  fallbackMaxSlotsPerPeriod,
  periodCapFromConfig,
  resolveDefaultSlotCap,
  type SlotPeriod
} from "@/lib/slot-capacity";
import { isBeforeMinReservationDate, isClosedReservationDate } from "@/lib/reservation-policy";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 30;

const SLOT_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120"
};
const SLOT_NO_STORE_HEADERS = {
  "Cache-Control": "no-store"
};

let skipTestOrderLookup = false;

function maxSlotsPerPeriod() {
  return fallbackMaxSlotsPerPeriod();
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function kstDateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function kstHour(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false
  }).format(date);
  return Number(hour);
}

function slotFromScheduledAt(value: string | null): SlotPeriod | null {
  if (!value) return null;
  return kstHour(value) < 13 ? "morning" : "afternoon";
}

function isMissingColumnError(error: any, column: string) {
  const message = String(error?.message ?? "");
  return error?.code === "42703" || (message.includes(column) && message.includes("does not exist"));
}

async function fetchTestOrderIds(supabase: ReturnType<typeof getSupabaseAdmin>, orderIds: Array<string | null | undefined>) {
  if (skipTestOrderLookup) return new Set<string>();

  const uniqueOrderIds = [...new Set(orderIds.filter(Boolean) as string[])];
  if (uniqueOrderIds.length === 0) return new Set<string>();

  const { data, error } = await supabase.from("orders").select("id,is_test").in("id", uniqueOrderIds);
  if (error) {
    if (isMissingColumnError(error, "is_test")) {
      skipTestOrderLookup = true;
      console.warn("[api/slots] orders.is_test is missing. Test orders will be included in slot counts until the migration is applied.");
      return new Set<string>();
    }
    throw error;
  }

  return new Set((data ?? []).filter((order) => order.is_test === true).map((order) => order.id));
}

function monthRange(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const queryStart = new Date(Date.UTC(year, month - 1, 1) - 24 * 60 * 60 * 1000);
  const queryEnd = new Date(Date.UTC(year, month, 1) + 24 * 60 * 60 * 1000);
  return {
    startDate: dateOnly(startDate),
    endDate: dateOnly(endDate),
    queryStart: queryStart.toISOString(),
    queryEnd: queryEnd.toISOString(),
    days: Array.from({ length: endDate.getUTCDate() }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`)
  };
}

function mockSlotPayload(year: number, month: number) {
  const defaultCap = maxSlotsPerPeriod();
  const range = monthRange(year, month);
  const slots: Record<string, SlotPeriod[]> = {};
  const closed: Record<string, SlotPeriod[]> = {};
  const usage: Record<string, Record<SlotPeriod, { used: number; cap: number }>> = {};
  const days: Record<
    string,
    {
      date: string;
      blocked: boolean;
      hasReservation: boolean;
      beforeMinDate: boolean;
      allFull: boolean;
      slots: Record<SlotPeriod, { used: number; cap: number; usedCount: number; maxCount: number; isFull: boolean; available: boolean }>;
    }
  > = {};

  for (const day of range.days) {
    const beforeMinDate = isBeforeMinReservationDate(day);
    const blocked = isClosedReservationDate(day);
    usage[day] = {
      morning: { used: 0, cap: defaultCap },
      afternoon: { used: 0, cap: defaultCap }
    };
    days[day] = {
      date: day,
      blocked,
      hasReservation: false,
      beforeMinDate,
      allFull: false,
      slots: {
        morning: {
          used: 0,
          cap: defaultCap,
          usedCount: 0,
          maxCount: defaultCap,
          isFull: false,
          available: !beforeMinDate && !blocked
        },
        afternoon: {
          used: 0,
          cap: defaultCap,
          usedCount: 0,
          maxCount: defaultCap,
          isFull: false,
          available: !beforeMinDate && !blocked
        }
      }
    };
    slots[day] = beforeMinDate || blocked ? [] : ["morning", "afternoon"];
    closed[day] = beforeMinDate || blocked ? ["morning", "afternoon"] : [];
  }

  return {
    year,
    month,
    maxSlotsPerPeriod: defaultCap,
    fallbackMaxSlotsPerPeriod: defaultCap,
    effectiveMaxSlotsPerPeriod: defaultCap,
    capSource: "local_mock",
    activeTechnicianCount: 0,
    slots,
    closed,
    usage,
    days
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const defaultYear = Number(kstDateOnly(now).slice(0, 4));
  const defaultMonth = Number(kstDateOnly(now).slice(5, 7));
  const year = boundedNumber(searchParams.get("year"), defaultYear, 2026, 2100);
  const month = boundedNumber(searchParams.get("month"), defaultMonth, 1, 12);
  const responseHeaders = searchParams.get("fresh") === "1" ? SLOT_NO_STORE_HEADERS : SLOT_CACHE_HEADERS;
  if (!hasSupabaseEnv()) return ok(mockSlotPayload(year, month), { headers: responseHeaders });

  const range = monthRange(year, month);
  const supabase = getSupabaseAdmin();

  let jobsResult: any;
  let configsResult: any;
  let capResult: Awaited<ReturnType<typeof resolveDefaultSlotCap>>;

  try {
    [jobsResult, configsResult, capResult] = await Promise.all([
      supabase
        .from("jobs")
        .select("id,order_id,scheduled_at,status")
        .not("scheduled_at", "is", null)
        .neq("status", "cancelled")
        .gte("scheduled_at", range.queryStart)
        .lt("scheduled_at", range.queryEnd),
      supabase
        .from("slot_configs")
        .select("date,morning_cap,afternoon_cap,blocked,type,cap_value,reason")
        .eq("type", "date")
        .gte("date", range.startDate)
        .lte("date", range.endDate),
      resolveDefaultSlotCap(supabase, { cache: true })
    ]);
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to resolve slot capacity.", 500);
  }

  const firstError = jobsResult.error ?? configsResult.error;
  if (firstError) return fail("internal_error", firstError.message, 500);

  let testOrderIds = new Set<string>();
  try {
    const jobRows = (jobsResult.data ?? []) as Array<{ order_id?: string | null }>;
    testOrderIds = await fetchTestOrderIds(supabase, jobRows.map((job) => job.order_id));
  } catch (error: any) {
    return fail("internal_error", error?.message ?? "Failed to load order test flags.", 500);
  }

  const defaultCapFromDb = capResult.cap;

  const counts = new Map<string, Record<SlotPeriod, number>>();
  const addCount = (dateText: string, period: SlotPeriod) => {
    if (!counts.has(dateText)) counts.set(dateText, { morning: 0, afternoon: 0 });
    counts.get(dateText)![period] += 1;
  };

  const jobRows = (jobsResult.data ?? []) as Array<{ order_id?: string | null; scheduled_at: string | null }>;

  for (const job of jobRows) {
    if (job.order_id && testOrderIds.has(job.order_id)) continue;
    if (!job.scheduled_at) continue;
    const period = slotFromScheduledAt(job.scheduled_at);
    if (!period) continue;
    const day = kstDateOnly(job.scheduled_at);
    if (day >= range.startDate && day <= range.endDate) addCount(day, period);
  }

  const configs = new Map<string, { date: string; morning_cap?: unknown; afternoon_cap?: unknown; blocked?: boolean | null }>(
    ((configsResult.data ?? []) as Array<{ date: string; morning_cap?: unknown; afternoon_cap?: unknown; blocked?: boolean | null }>).map((config) => [config.date, config])
  );
  const slots: Record<string, SlotPeriod[]> = {};
  const closed: Record<string, SlotPeriod[]> = {};
  const usage: Record<string, Record<SlotPeriod, { used: number; cap: number }>> = {};
  const days: Record<
    string,
    {
      date: string;
      blocked: boolean;
      hasReservation: boolean;
      beforeMinDate: boolean;
      allFull: boolean;
      slots: Record<SlotPeriod, { used: number; cap: number; usedCount: number; maxCount: number; isFull: boolean; available: boolean }>;
    }
  > = {};

  for (const day of range.days) {
    const config = configs.get(day);
    const dayCounts = counts.get(day) ?? { morning: 0, afternoon: 0 };
    const caps = {
      morning: periodCapFromConfig(config, "morning", defaultCapFromDb),
      afternoon: periodCapFromConfig(config, "afternoon", defaultCapFromDb)
    };
    const morningFull = dayCounts.morning >= caps.morning;
    const afternoonFull = dayCounts.afternoon >= caps.afternoon;
    usage[day] = {
      morning: { used: dayCounts.morning, cap: caps.morning },
      afternoon: { used: dayCounts.afternoon, cap: caps.afternoon }
    };
    const beforeMinDate = isBeforeMinReservationDate(day);
    const blocked = Boolean(config?.blocked) || isClosedReservationDate(day);
    const hasReservation = dayCounts.morning > 0 || dayCounts.afternoon > 0;
    days[day] = {
      date: day,
      blocked,
      hasReservation,
      beforeMinDate,
      allFull: morningFull && afternoonFull,
      slots: {
        morning: {
          used: dayCounts.morning,
          cap: caps.morning,
          usedCount: dayCounts.morning,
          maxCount: caps.morning,
          isFull: morningFull,
          available: !beforeMinDate && !blocked && !morningFull
        },
        afternoon: {
          used: dayCounts.afternoon,
          cap: caps.afternoon,
          usedCount: dayCounts.afternoon,
          maxCount: caps.afternoon,
          isFull: afternoonFull,
          available: !beforeMinDate && !blocked && !afternoonFull
        }
      }
    };

    if (beforeMinDate || blocked) {
      slots[day] = [];
      closed[day] = ["morning", "afternoon"];
      continue;
    }

    const available: SlotPeriod[] = [];
    const unavailable: SlotPeriod[] = [];
    for (const period of ["morning", "afternoon"] as const) {
      if (dayCounts[period] < caps[period]) available.push(period);
      else unavailable.push(period);
    }
    slots[day] = available;
    closed[day] = unavailable;
  }

  return ok({
    year,
    month,
    maxSlotsPerPeriod: defaultCapFromDb,
    fallbackMaxSlotsPerPeriod: capResult.fallbackMaxSlotsPerPeriod,
    effectiveMaxSlotsPerPeriod: defaultCapFromDb,
    capSource: capResult.capSource,
    activeTechnicianCount: capResult.activeTechnicianCount,
    slots,
    closed,
    usage,
    days
  }, { headers: responseHeaders });
}
