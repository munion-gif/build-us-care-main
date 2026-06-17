export const RESERVATION_LEAD_DAYS = 3;

export const KR_PUBLIC_HOLIDAYS = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-03-01",
  "2026-03-02",
  "2026-05-05",
  "2026-05-24",
  "2026-05-25",
  "2026-06-03",
  "2026-06-06",
  "2026-08-15",
  "2026-08-17",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-10-03",
  "2026-10-05",
  "2026-10-09",
  "2026-12-25"
]);

export function kstDateText(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function minReservationDateText(today = new Date()) {
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + RESERVATION_LEAD_DAYS);
  return kstDateText(minDate);
}

export function isBeforeMinReservationDate(dateText: string, today = new Date()) {
  return dateText < minReservationDateText(today);
}

export function localDateFromText(dateText: string) {
  const [year, month, day] = dateText.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function isKoreanPublicHoliday(dateText: string) {
  return KR_PUBLIC_HOLIDAYS.has(dateText);
}

export function isClosedReservationDate(dateText: string) {
  const date = localDateFromText(dateText);
  if (!date) return true;
  return date.getDay() === 0 || isKoreanPublicHoliday(dateText);
}

export function closedReservationReason(dateText: string) {
  const date = localDateFromText(dateText);
  if (!date) return "예약할 수 없는 날짜입니다.";
  if (date.getDay() === 0) return "일요일은 휴무입니다. 다른 날짜를 선택해주세요.";
  if (isKoreanPublicHoliday(dateText)) return "공휴일은 휴무입니다. 다른 날짜를 선택해주세요.";
  return "";
}
