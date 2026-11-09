// Ghana uses Africa/Accra (GMT, UTC+0, no daylight saving). We still format with the
// explicit zone so server locale/timezone never changes what users see.
export const TIMEZONE = "Africa/Accra";

const dateFmt = new Intl.DateTimeFormat("en-GH", { timeZone: TIMEZONE, day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GH", { timeZone: TIMEZONE, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);

/** "YYYY-MM-DD" for the calendar day in Accra. */
export const toAccraDay = (d: Date) => isoDayFmt.format(d);

/** Parse "YYYY-MM-DD" (from <input type=date>) as midnight in Accra. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`); // Accra is UTC+0
  return Number.isNaN(d.getTime()) || toAccraDay(d) !== value ? null : d;
}

/** Start of today in Accra. */
export function startOfToday(now = new Date()): Date {
  return parseDay(toAccraDay(now))!;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function startOfMonth(now = new Date()): Date {
  return parseDay(`${toAccraDay(now).slice(0, 7)}-01`)!;
}

/** Whole days overdue (0 if not yet due). */
export function daysOverdue(dueDate: Date, now = new Date()): number {
  const diff = startOfToday(now).getTime() - startOfToday(dueDate).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}
