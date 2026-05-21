export function createOrderDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export function createOrderNumber(date = new Date(), sequence?: number) {
  const dateKey = createOrderDateKey(date);

  if (sequence !== undefined) {
    return `BO-${dateKey}-${String(sequence).padStart(4, "0")}`;
  }

  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BO-${dateKey}-${suffix}`;
}
