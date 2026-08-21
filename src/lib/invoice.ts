import { resolveRate, type RateLike } from "./rates";
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
 *  Each day resolves to exactly one rate, so a day belongs wholly to one
 *  period — no partial-day splitting. A period runs from one rate's effective
 *  date to the day before the next takes effect, clamped to the billed period,
 *  so with no rate change the whole month collapses to a single line.
 *
 *  Rate-periods with no hours logged produce no line. */
export function computeInvoice(
  entries: InvoiceEntryLike[],
  rates: RateLike[],
  periodStart: string,
  periodEnd: string,
): InvoiceComputation {
  const byDate = hoursByDate(entries, periodStart, periodEnd);

  // accumulate per resolved rate row, tracking the actual worked span so a
  // line's description covers the days billed rather than the rate's full reach
  interface Bucket {
    rate: number;
    hours: number;
    firstDate: string;
    lastDate: string;
    effectiveDate: string;
  }
  const buckets = new Map<string, Bucket>();
  const unratedDates: string[] = [];
  let unratedHours = 0;

  for (const [date, hours] of [...byDate].sort()) {
    const resolved = resolveRate(rates, date);
    if (!resolved) {
      if (hours > 0) {
        unratedDates.push(date);
        unratedHours += hours;
      }
      continue;
    }
    const found = buckets.get(resolved.id);
    if (found) {
      found.hours += hours;
      if (date < found.firstDate) found.firstDate = date;
      if (date > found.lastDate) found.lastDate = date;
    } else {
      buckets.set(resolved.id, {
        rate: resolved.rate,
        hours,
        firstDate: date,
        lastDate: date,
        effectiveDate: resolved.effectiveDate,
      });
    }
  }

  const lines: InvoiceLine[] = [...buckets.values()]
    .filter((b) => b.hours > 0)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    .map((b) => ({
      item: INVOICE_ITEM_LABEL,
      description: describePeriod(b.firstDate, b.lastDate),
      periodStart: b.firstDate,
      periodEnd: b.lastDate,
      hours: b.hours,
      rate: b.rate,
      amount: roundCents(b.hours * b.rate),
    }));

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
