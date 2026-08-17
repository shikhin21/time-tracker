import { splitWeekByMonth } from "./dates";
import { toQuarters } from "./validation";

export interface EntryLike {
  date: string; // "YYYY-MM-DD"
  hours: number;
}

/** Per-day totals in quarter-units. A day whose entries sum to 0 is present
 *  in the map (renders as "0"); an untouched day is absent (renders blank). */
export function sumByDay(entries: EntryLike[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of entries) {
    totals.set(e.date, (totals.get(e.date) ?? 0) + toQuarters(e.hours));
  }
  return totals;
}

/** Sum (in quarters) over the given date keys. Callers pass in-month keys
 *  only to get the in-month contribution of a straddling week. */
export function sumForDays(dayTotals: Map<string, number>, dateKeys: string[]): number {
  let sum = 0;
  for (const key of dateKeys) sum += dayTotals.get(key) ?? 0;
  return sum;
}

export function sumForMonth(dayTotals: Map<string, number>, monthKey: string): number {
  let sum = 0;
  for (const [key, quarters] of dayTotals) {
    if (key.startsWith(monthKey)) sum += quarters;
  }
  return sum;
}

export function sumForYear(dayTotals: Map<string, number>, year: number): number {
  const prefix = `${year}-`;
  let sum = 0;
  for (const [key, quarters] of dayTotals) {
    if (key.startsWith(prefix)) sum += quarters;
  }
  return sum;
}

export interface WeekSplitTotal {
  year: number;
  month: number; // 1-based
  monthKey: string;
  quarters: number;
}

/** Per-month subtotals for a (possibly straddling) week — 1 or 2 segments,
 *  chronological. The week view's split display. */
export function weekSplitTotals(
  dayTotals: Map<string, number>,
  weekKey: string,
): WeekSplitTotal[] {
  return splitWeekByMonth(weekKey).map((seg) => ({
    year: seg.year,
    month: seg.month,
    monthKey: seg.monthKey,
    quarters: sumForDays(dayTotals, seg.dateKeys),
  }));
}
