import { getSupabaseAdmin } from "@/lib/supabase";

export type SlotPeriod = "morning" | "afternoon";
export type SlotCapSource = "manual" | "active_technicians" | "no_active_technicians" | "local_mock";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const DEFAULT_MAX_SLOTS = 3;
const MIN_CAP = 0;
const MAX_CAP = 20;

export function boundedNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export function fallbackMaxSlotsPerPeriod() {
  return boundedNumber(process.env.MAX_SLOTS_PER_PERIOD ?? null, DEFAULT_MAX_SLOTS, 1, MAX_CAP);
}

export function normalizeSlotCap(value: unknown, fallback: number, min = MIN_CAP) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), MAX_CAP);
}

export async function resolveDefaultSlotCap(supabase: SupabaseAdmin) {
  const fallbackCap = fallbackMaxSlotsPerPeriod();
  const [capConfigResult, activeTechniciansResult] = await Promise.all([
    supabase.from("app_configs").select("value").eq("key", "slot_cap").maybeSingle(),
    supabase.from("technicians").select("id", { count: "exact", head: true }).eq("is_active", true)
  ]);

  if (capConfigResult.error) throw new Error(capConfigResult.error.message);
  if (activeTechniciansResult.error) throw new Error(activeTechniciansResult.error.message);

  const manualCap = Number(capConfigResult.data?.value);
  const activeTechnicianCount = activeTechniciansResult.count ?? 0;

  if (Number.isFinite(manualCap) && manualCap > 0) {
    return {
      cap: normalizeSlotCap(manualCap, fallbackCap, 1),
      capSource: "manual" as SlotCapSource,
      activeTechnicianCount,
      fallbackMaxSlotsPerPeriod: fallbackCap
    };
  }

  if (activeTechnicianCount > 0) {
    return {
      cap: normalizeSlotCap(activeTechnicianCount, fallbackCap, 1),
      capSource: "active_technicians" as SlotCapSource,
      activeTechnicianCount,
      fallbackMaxSlotsPerPeriod: fallbackCap
    };
  }

  return {
    cap: 0,
    capSource: "no_active_technicians" as SlotCapSource,
    activeTechnicianCount,
    fallbackMaxSlotsPerPeriod: fallbackCap
  };
}

export function periodCapFromConfig(
  config: { morning_cap?: unknown; afternoon_cap?: unknown } | null | undefined,
  period: SlotPeriod,
  defaultCap: number
) {
  const configuredCap = period === "morning" ? config?.morning_cap : config?.afternoon_cap;
  return normalizeSlotCap(configuredCap, defaultCap);
}
