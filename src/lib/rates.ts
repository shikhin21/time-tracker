import { addDays } from "date-fns";
import { parseDateKey, toDateKey } from "./dates";

export interface RateLike {
  id: string;
  effectiveDate: string; // "YYYY-MM-DD"
  rate: number;
}

export function sortRates<T extends RateLike>(rates: T[]): T[] {
  return [...rates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

/** The rate in effect on a day: the row with the latest effectiveDate ≤ that
 *  day. `undefined` = no rate set (day precedes the first effectiveDate). */
export function resolveRate<T extends RateLike>(
  rates: T[],
  dateKey: string,
): T | undefined {
  let best: T | undefined;
  for (const r of rates) {
    if (r.effectiveDate <= dateKey && (!best || r.effectiveDate > best.effectiveDate)) {
      best = r;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Changes and conflict checking
// ---------------------------------------------------------------------------

export type RateChange =
  | { type: "add"; effectiveDate: string; rate: number }
  | { type: "edit-value"; rateId: string; newRate: number }
  | { type: "edit-date"; rateId: string; newEffectiveDate: string }
  | { type: "delete"; rateId: string };

/** One rate per (project, effectiveDate). Returns the user-facing rejection
 *  reason, or null if the change is allowed. */
export function checkRateDateConflict(
  rates: RateLike[],
  change: RateChange,
): string | null {
  const targetDate =
    change.type === "add"
      ? change.effectiveDate
      : change.type === "edit-date"
        ? change.newEffectiveDate
        : null;
  if (targetDate === null) return null;
  const excludeId = change.type === "edit-date" ? change.rateId : null;
  const clash = rates.find(
    (r) => r.effectiveDate === targetDate && r.id !== excludeId,
  );
  return clash
    ? `A rate already exists for ${targetDate}. Edit that rate instead.`
    : null;
}

export function applyRateChange(rates: RateLike[], change: RateChange): RateLike[] {
  switch (change.type) {
    case "add":
      return [
        ...rates,
        { id: "(new)", effectiveDate: change.effectiveDate, rate: change.rate },
      ];
    case "edit-value":
      return rates.map((r) =>
        r.id === change.rateId ? { ...r, rate: change.newRate } : r,
      );
    case "edit-date":
      return rates.map((r) =>
        r.id === change.rateId ? { ...r, effectiveDate: change.newEffectiveDate } : r,
      );
    case "delete":
      return rates.filter((r) => r.id !== change.rateId);
  }
}

// ---------------------------------------------------------------------------
// "Show what's affected": diff the resolved-rate timeline before vs. after
// ---------------------------------------------------------------------------

export interface ImpactSegment {
  fromDate: string;
  /** Inclusive end, or null when the segment runs open-ended into the future. */
  toDate: string | null;
  oldRate: number | null; // null = no rate set
  newRate: number | null;
}

export interface RateImpact {
  segments: ImpactSegment[];
  affectedEntryCount: number;
  /** Actual span of affected *entries* (min/max date), null when none. */
  affectedFrom: string | null;
  affectedTo: string | null;
  /** True when some span that had a rate ends up with no rate. */
  becomesNoRate: boolean;
}

export type CountEntriesFn = (
  fromDate: string,
  toDateOrNull: string | null,
) => Promise<{ count: number; minDate: string | null; maxDate: string | null }>;

function dayBefore(dateKey: string): string {
  return toDateKey(addDays(parseDateKey(dateKey), -1));
}

/** Segments (merged, chronological) where the resolved rate differs between
 *  the old and new rate lists. Works uniformly for add/edit/delete because it
 *  diffs outcomes, not operations. */
export function diffRateTimelines(
  oldRates: RateLike[],
  newRates: RateLike[],
): ImpactSegment[] {
  const boundaries = [
    ...new Set([...oldRates, ...newRates].map((r) => r.effectiveDate)),
  ].sort();

  const segments: ImpactSegment[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const from = boundaries[i];
    const next = boundaries[i + 1] ?? null;
    const oldRate = resolveRate(oldRates, from)?.rate ?? null;
    const newRate = resolveRate(newRates, from)?.rate ?? null;
    if (oldRate === newRate) continue;
    segments.push({
      fromDate: from,
      toDate: next === null ? null : dayBefore(next),
      oldRate,
      newRate,
    });
  }
  return segments;
}

export async function computeRateImpact(
  rates: RateLike[],
  change: RateChange,
  countEntries: CountEntriesFn,
): Promise<RateImpact> {
  const segments = diffRateTimelines(rates, applyRateChange(rates, change));

  let affectedEntryCount = 0;
  let affectedFrom: string | null = null;
  let affectedTo: string | null = null;
  for (const seg of segments) {
    const { count, minDate, maxDate } = await countEntries(seg.fromDate, seg.toDate);
    affectedEntryCount += count;
    if (minDate && (!affectedFrom || minDate < affectedFrom)) affectedFrom = minDate;
    if (maxDate && (!affectedTo || maxDate > affectedTo)) affectedTo = maxDate;
  }

  return {
    segments,
    affectedEntryCount,
    affectedFrom,
    affectedTo,
    becomesNoRate: segments.some((s) => s.oldRate !== null && s.newRate === null),
  };
}
