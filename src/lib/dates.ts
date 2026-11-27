export const DEFAULT_TIMEZONE = "Africa/Douala";

export function todayInZone(timeZone = DEFAULT_TIMEZONE, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function formatDate(
  value: string | Date,
  locale = "en",
  timeZone = DEFAULT_TIMEZONE,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === "string" ? new Date(`${value.length === 10 ? `${value}T12:00:00Z` : value}`) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
    ...options,
  }).format(date);
}

export function formatDateTime(value: string | Date, locale = "en", timeZone = DEFAULT_TIMEZONE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** First and last day (inclusive) of the month containing `date`. */
export function monthBounds(date = new Date(), timeZone = DEFAULT_TIMEZONE): { start: string; end: string } {
  const today = todayInZone(timeZone, date);
  const [year, month] = today.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0));
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(
    endDate.getUTCDate(),
  ).padStart(2, "0")}`;
  return { start, end };
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function hourInZone(timeZone = DEFAULT_TIMEZONE, now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(now);
  return Number(hour);
}

export function weekdayInZone(timeZone = DEFAULT_TIMEZONE, now = new Date()): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

export function isLastDayOfMonthInZone(timeZone = DEFAULT_TIMEZONE, now = new Date()): boolean {
  return todayInZone(timeZone, now) === monthBounds(now, timeZone).end;
}
