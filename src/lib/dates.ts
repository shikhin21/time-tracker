import { addDays, addMonths, addWeeks, endOfMonth, startOfWeek, getWeek } from "date-fns";
import type { Locale } from "date-fns";
import { enUS } from "date-fns/locale";
import * as allLocales from "date-fns/locale";

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

let activeLocale: Locale = enUS;

/** Map a BCP-47 tag ("de-DE") to a date-fns Locale, falling back to the bare
 *  language ("de") and finally enUS. */
export function resolveDateFnsLocale(tag: string): Locale {
  const locales = allLocales as unknown as Record<string, Locale | undefined>;
  const exact = tag.replace(/-/g, "");
  const language = tag.split("-")[0];
  return locales[exact] ?? locales[language] ?? enUS;
}

export function detectLocale(): Locale {
  const tag =
    typeof navigator !== "undefined" && navigator.language
      ? navigator.language
      : "en-US";
  return resolveDateFnsLocale(tag);
}

export function initLocale(): void {
  activeLocale = detectLocale();
}

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

// ---------------------------------------------------------------------------
// Date keys ("YYYY-MM-DD" calendar dates, always local — never UTC-parsed)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse to a Date at *local* midnight. `new Date("YYYY-MM-DD")` would parse
 *  as UTC midnight and shift the calendar day in western timezones. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function yearOf(dateKey: string): number {
  return Number(dateKey.slice(0, 4));
}

/** "YYYY-MM" */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function isInMonth(dateKey: string, monthKey: string): boolean {
  return dateKey.startsWith(monthKey);
}

/** Saturday or Sunday — styled as off days in every view. */
export function isWeekend(dateKey: string): boolean {
  const day = parseDateKey(dateKey).getDay();
  return day === 0 || day === 6;
}

// ---------------------------------------------------------------------------
// Weeks (locale-driven: the canonical week key is the week's start date)
// ---------------------------------------------------------------------------

export function weekKeyFor(dateKey: string, locale: Locale = activeLocale): string {
  return toDateKey(startOfWeek(parseDateKey(dateKey), { locale }));
}

export function weekNumber(dateKey: string, locale: Locale = activeLocale): number {
  return getWeek(parseDateKey(dateKey), { locale });
}

/** Last calendar day of a month: "2026-07" -> "2026-07-31". */
export function monthEndKey(monthKey: string): string {
  return toDateKey(endOfMonth(parseDateKey(`${monthKey}-01`)));
}

/** The 7 date keys of the week starting at `weekKey`. */
export function weekDates(weekKey: string): string[] {
  const start = parseDateKey(weekKey);
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}

export function addWeeksKey(weekKey: string, n: number): string {
  return toDateKey(addWeeks(parseDateKey(weekKey), n));
}

export function addMonthsKey(monthKey: string, n: number): string {
  return monthKeyOf(toDateKey(addMonths(parseDateKey(`${monthKey}-01`), n)));
}

// ---------------------------------------------------------------------------
// Month grid + straddling weeks
// ---------------------------------------------------------------------------

/** The full calendar grid for a month (1-based) as week rows of 7 date keys,
 *  including leading/trailing out-of-month days. Drives month view rows and
 *  the year view's minis. */
export function monthGridWeeks(
  year: number,
  month: number,
  locale: Locale = activeLocale,
): string[][] {
  const monthKey = `${year}-${pad(month)}`;
  const lastDay = new Date(year, month, 0).getDate();
  const weeks: string[][] = [];
  let week = weekKeyFor(`${monthKey}-01`, locale);
  const lastWeek = weekKeyFor(`${monthKey}-${pad(lastDay)}`, locale);
  for (;;) {
    weeks.push(weekDates(week));
    if (week === lastWeek) break;
    week = addWeeksKey(week, 1);
  }
  return weeks;
}

export interface WeekMonthSegment {
  year: number;
  month: number; // 1-based
  monthKey: string;
  dateKeys: string[];
}

/** Split a week's 7 days by calendar month — always 1 or 2 chronologically
 *  ordered segments. */
export function splitWeekByMonth(weekKey: string): WeekMonthSegment[] {
  const segments: WeekMonthSegment[] = [];
  for (const dateKey of weekDates(weekKey)) {
    const monthKey = monthKeyOf(dateKey);
    const last = segments[segments.length - 1];
    if (last && last.monthKey === monthKey) {
      last.dateKeys.push(dateKey);
    } else {
      segments.push({
        year: yearOf(dateKey),
        month: Number(dateKey.slice(5, 7)),
        monthKey,
        dateKeys: [dateKey],
      });
    }
  }
  return segments;
}

export function weekStraddlesYear(weekKey: string): boolean {
  const days = weekDates(weekKey);
  return yearOf(days[0]) !== yearOf(days[6]);
}
