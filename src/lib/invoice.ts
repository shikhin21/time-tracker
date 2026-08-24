import { addDays } from "date-fns";
import { parseDateKey, toDateKey } from "./dates";
import { sortRates, type RateLike } from "./rates";
import { toQuarters } from "./validation";

export const INVOICE_ITEM_LABEL = "Software services";

export interface InvoiceEntryLike {
  date: string; // "YYYY-MM-DD"
  hours: number;
}

export interface InvoiceLine {
  item: string;
  description: string;
  /** Rate-period boundaries, clamped to the billed period. */
  periodStart: string;
  periodEnd: string;
  hours: number;
  rate: number;
  amount: number;
}

export interface InvoiceComputation {
  lines: InvoiceLine[];
  subtotal: number;
  salesTax: number;
  total: number;
  payments: number;
  amountDue: number;
  /** Days carrying hours that precede the project's first rate — unbillable,
   *  since there is no rate to multiply by. Excluded from `lines`. */
  unratedDates: string[];
  unratedHours: number;
}

const minKey = (a: string, b: string) => (a < b ? a : b);
const maxKey = (a: string, b: string) => (a > b ? a : b);

function dayBefore(dateKey: string): string {
  return toDateKey(addDays(parseDateKey(dateKey), -1));
}

/** Money is rounded to cents at each line, then summed, so the printed lines
 *  always add up to the printed subtotal. */
function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Invoices print dates as mm-dd-yyyy, matching the sample — unlike the rest
 *  of the app, which shows locale-formatted dates. */
export function formatInvoiceDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${m}-${d}-${y}`;
}

/** "3360.00" — two decimals, no thousands separator, as in the sample. The
 *  "$" is added by whichever cell prints it. */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/** Hours print without trailing zeros: 64, 63.5, 3.25. */
export function formatInvoiceHours(hours: number): string {
  return String(Number(hours.toFixed(2)));
}

export function describePeriod(periodStart: string, periodEnd: string): string {
  return `For services rendered from ${formatInvoiceDate(periodStart)} to ${formatInvoiceDate(periodEnd)}`;
}

/** Hours per day, in hours (not quarters), for days inside the period. */
function hoursByDate(
  entries: InvoiceEntryLike[],
  periodStart: string,
  periodEnd: string,
): Map<string, number> {
  const quarters = new Map<string, number>();
  for (const e of entries) {
    if (e.date < periodStart || e.date > periodEnd) continue;
    quarters.set(e.date, (quarters.get(e.date) ?? 0) + toQuarters(e.hours));
  }
  return new Map([...quarters].map(([date, q]) => [date, q / 4]));
}

/** Group the billed period's worked days into contiguous rate-periods and
 *  build one summary line per period (§6).
 *
 *  A line's date range is the rate-period itself — from the rate's effective
 *  date to the day before the next rate takes over — clamped to the billed
 *  period, so an unchanged rate collapses the whole month into one line reading
 *  the period's own dates. It deliberately isn't the span of days that happen
 *  to carry hours: a month worked through the 30th is still billed for the
 *  month, and a client reading the line sees the period they're being billed
 *  for rather than an inference about which days were idle.
 *
 *  Each day resolves to exactly one rate, so a day belongs wholly to one
 *  period — no partial-day splitting. Rate-periods with no hours logged produce
 *  no line. */
export function computeInvoice(
  entries: InvoiceEntryLike[],
  rates: RateLike[],
  periodStart: string,
  periodEnd: string,
): InvoiceComputation {
  const byDate = hoursByDate(entries, periodStart, periodEnd);
  const sorted = sortRates(rates);

  // days preceding every rate can't be billed — there's no rate to multiply by
  const firstEffective = sorted[0]?.effectiveDate;
  const unratedDates: string[] = [];
  let unratedHours = 0;
  for (const [date, hours] of [...byDate].sort()) {
    if (hours > 0 && (firstEffective === undefined || date < firstEffective)) {
      unratedDates.push(date);
      unratedHours += hours;
    }
  }

  const lines: InvoiceLine[] = [];
  for (const [i, rate] of sorted.entries()) {
    const spanStart = maxKey(rate.effectiveDate, periodStart);
    const next = sorted[i + 1];
    const spanEnd = minKey(next ? dayBefore(next.effectiveDate) : periodEnd, periodEnd);
    if (spanStart > spanEnd) continue; // this rate never applies inside the period

    let hours = 0;
    for (const [date, dayHours] of byDate) {
      if (date >= spanStart && date <= spanEnd) hours += dayHours;
    }
    if (hours <= 0) continue;

    lines.push({
      item: INVOICE_ITEM_LABEL,
      description: describePeriod(spanStart, spanEnd),
      periodStart: spanStart,
      periodEnd: spanEnd,
      hours,
      rate: rate.rate,
      amount: roundCents(hours * rate.rate),
    });
  }

  const subtotal = roundCents(lines.reduce((sum, l) => sum + l.amount, 0));
  const salesTax = 0; // v1: stored, no edit UI
  const total = roundCents(subtotal + salesTax);
  const payments = 0; // v1: stored, no edit UI
  return {
    lines,
    subtotal,
    salesTax,
    total,
    payments,
    amountDue: roundCents(total - payments),
    unratedDates,
    unratedHours,
  };
}

/** The next number in a project's sequence, derived from the invoices already
 *  issued rather than a mutable counter that could drift.
 *
 *  Numbers are strings so a leading-zero style ("036") survives; the increment
 *  preserves the width of the highest number seen. Returns null when the
 *  project has never been invoiced — the user seeds the sequence by hand. */
export function nextInvoiceNumber(existingNumbers: string[]): string | null {
  const numeric = existingNumbers
    .map((n) => ({ raw: n.trim(), value: Number(n.trim()) }))
    .filter((n) => n.raw !== "" && Number.isFinite(n.value));
  if (numeric.length === 0) return null;

  const highest = numeric.reduce((max, n) => (n.value > max.value ? n : max));
  const next = String(highest.value + 1);
  return next.padStart(highest.raw.length, "0");
}
