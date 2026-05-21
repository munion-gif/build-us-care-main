import { fail, ok } from "@/lib/api-response";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 30;

type SlotPeriod = "morning" | "afternoon";

const DEFAULT_MAX_SLOTS = 3;

function boundedNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function maxSlotsPerPeriod() {
  return boundedNumber(process.env.MAX_SLOTS_PER_PERIOD ?? null, DEFAULT_MAX_SLOTS, 1, 20);
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

function minReservationDateText() {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 3);
  return kstDateOnly(minDate);
}

function isBeforeMinReservationDate(dateText: string) {
  return dateText < minReservationDateText();
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
      beforeMinDate: boolean;
      allFull: boolean;
      slots: Record<SlotPeriod, { used: number; cap: number; usedCount: number; maxCount: number; isFull: boolean; available: boolean }>;
    }
  > = {};

  for (const day of range.days) {
    const beforeMinDate = isBeforeMinReservationDate(day);
    usage[day] = {
      morning: { used: 0, cap: defaultCap },
      afternoon: { used: 0, cap: defaultCap }
    };
    days[day] = {
      date: day,
      blocked: false,
      beforeMinDate,
      allFull: false,
      slots: {
        morning: {
          used: 0,
          cap: defaultCap,
          usedCount: 0,
          maxCount: defaultCap,
          isFull: false,
          available: !beforeMinDate
        },
        afternoon: {
          used: 0,
          cap: defaultCap,
          usedCount: 0,
          maxCount: defaultCap,
          isFull: false,
          available: !beforeMinDate
        }
      }
    };
    slots[day] = beforeMinDate ? [] : ["morning", "afternoon"];
    closed[day] = beforeMinDate ? ["morning", "afternoon"] : [];
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
  if (!hasSupabaseEnv() && process.env.NODE_ENV !== "production") return ok(mockSlotPayload(year, month));
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const defaultCap = maxSlotsPerPeriod();
  const range = monthRange(year, month);
  const supabase = getSupabaseAdmin();

  const [jobsResult, reservationsResult, configsResult, capConfigResult, activeTechniciansResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,scheduled_at,status")
      .not("scheduled_at", "is", null)
      .neq("status", "cancelled")
      .gte("scheduled_at", range.queryStart)
      .lt("scheduled_at", range.queryEnd),
    supabase
      .from("reservations")
      .select("id,reserved_date,time_slot,status")
      .gte("reserved_date", range.startDate)
      .lte("reserved_date", range.endDate)
      .neq("status", "cancelled"),
    supabase
      .from("slot_configs")
      .select("date,morning_cap,afternoon_cap,blocked,type,cap_value,reason")
      .eq("type", "date")
      .gte("date", range.startDate)
      .lte("date", range.endDate),
    supabase
      .from("app_configs")
      .select("value")
      .eq("key", "slot_cap")
      .maybeSingle(),
    supabase
      .from("technicians")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
  ]);

  const firstError = jobsResult.error ?? reservationsResult.error ?? configsResult.error ?? capConfigResult.error ?? activeTechniciansResult.error;
  if (firstError) return fail("internal_error", firstError.message, 500);
  const manualCap = Number(capConfigResult.data?.value);
  const activeTechnicianCount = activeTechniciansResult.count ?? 0;
  const defaultCapFromDb =
    Number.isFinite(manualCap) && manualCap > 0
      ? boundedNumber(String(manualCap), defaultCap, 1, 20)
      : activeTechnicianCount > 0
        ? boundedNumber(String(activeTechnicianCount), defaultCap, 1, 20)
        : defaultCap;
  const capSource =
    Number.isFinite(manualCap) && manualCap > 0
      ? "manual"
      : activeTechnicianCount > 0
        ? "active_technicians"
        : "fallback";

  const counts = new Map<string, Record<SlotPeriod, number>>();
  const addCount = (dateText: string, period: SlotPeriod) => {
    if (!counts.has(dateText)) counts.set(dateText, { morning: 0, afternoon: 0 });
    counts.get(dateText)![period] += 1;
  };

  for (const job of jobsResult.data ?? []) {
    const period = slotFromScheduledAt(job.scheduled_at);
    if (!period) continue;
    const day = kstDateOnly(job.scheduled_at);
    if (day >= range.startDate && day <= range.endDate) addCount(day, period);
  }

  for (const reservation of reservationsResult.data ?? []) {
    if (reservation.time_slot === "morning" || reservation.time_slot === "afternoon") {
      addCount(reservation.reserved_date, reservation.time_slot);
    }
  }

  const configs = new Map((configsResult.data ?? []).map((config) => [config.date, config]));
  const slots: Record<string, SlotPeriod[]> = {};
  const closed: Record<string, SlotPeriod[]> = {};
  const usage: Record<string, Record<SlotPeriod, { used: number; cap: number }>> = {};
  const days: Record<
    string,
    {
      date: string;
      blocked: boolean;
      beforeMinDate: boolean;
      allFull: boolean;
      slots: Record<SlotPeriod, { used: number; cap: number; usedCount: number; maxCount: number; isFull: boolean; available: boolean }>;
    }
  > = {};

  for (const day of range.days) {
    const config = configs.get(day);
    const dayCounts = counts.get(day) ?? { morning: 0, afternoon: 0 };
    const caps = {
      morning: Number(config?.morning_cap ?? defaultCapFromDb),
      afternoon: Number(config?.afternoon_cap ?? defaultCapFromDb)
    };
    const morningFull = dayCounts.morning >= caps.morning;
    const afternoonFull = dayCounts.afternoon >= caps.afternoon;
    usage[day] = {
      morning: { used: dayCounts.morning, cap: caps.morning },
      afternoon: { used: dayCounts.afternoon, cap: caps.afternoon }
    };
    const beforeMinDate = isBeforeMinReservationDate(day);
    const blocked = Boolean(config?.blocked);
    days[day] = {
      date: day,
      blocked,
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
    fallbackMaxSlotsPerPeriod: defaultCap,
    effectiveMaxSlotsPerPeriod: defaultCapFromDb,
    capSource,
    activeTechnicianCount,
    slots,
    closed,
    usage,
    days
  });
}
