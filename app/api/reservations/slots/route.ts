import { ok } from "@/lib/api-response";

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? toDateOnly(new Date());
  const days = Number(searchParams.get("days") ?? 7);
  const start = new Date(`${from}T00:00:00.000Z`);
  const length = Number.isFinite(days) ? Math.min(Math.max(days, 1), 31) : 7;

  const slots = Array.from({ length }).flatMap((_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const day = date.getUTCDay();
    const dateText = toDateOnly(date);
    const closed = day === 0;

    return (["morning", "afternoon", "all_day"] as const).map((timeSlot) => ({
      reserved_date: dateText,
      time_slot: timeSlot,
      available: !closed && !(day === 6 && timeSlot === "all_day"),
      reason: closed ? "sunday_closed" : day === 6 && timeSlot === "all_day" ? "saturday_split_only" : null
    }));
  });

  return ok({
    from,
    days: length,
    rule: "Sunday closed. Saturday all_day unavailable. Other slots are available in MVP mock mode.",
    slots
  });
}
