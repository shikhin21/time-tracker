import { format } from "date-fns";
import type { Locale } from "date-fns";
import { getActiveLocale, parseDateKey } from "./dates";
import { fromQuarters } from "./validation";
import type { WeekSplitTotal } from "./totals";

/** Quarter-units → display string: 12.5, 0.25, 6, 0. */
export function formatQuarters(quarters: number): string {
  return String(fromQuarters(quarters));
}

export function formatHoursLabel(quarters: number): string {
  return `${formatQuarters(quarters)}h`;
}

/** "$85.00" — display only in v1; "no rate set" renders as "—" elsewhere. */
export function formatRate(rate: number): string {
  return `$${rate.toFixed(2)}`;
}

export function formatDateKey(
  dateKey: string,
  pattern: string,
  locale: Locale = getActiveLocale(),
): string {
  return format(parseDateKey(dateKey), pattern, { locale });
}

/** Split-week label: `Dec: 12.5h · Jan: 6h`, with years only when the week
 *  crosses a year boundary: `Dec 2026: 12.5h · Jan 2027: 6h`. */
export function formatWeekSplitLabel(
  splits: WeekSplitTotal[],
  locale: Locale = getActiveLocale(),
): string {
  const crossesYear = new Set(splits.map((s) => s.year)).size > 1;
  return splits
    .map((s) => {
      const month = format(parseDateKey(`${s.monthKey}-01`), "MMM", { locale });
      const label = crossesYear ? `${month} ${s.year}` : month;
      return `${label}: ${formatHoursLabel(s.quarters)}`;
    })
    .join(" · ");
}
