export const MAX_DAY_QUARTERS = 24 * 4;

/** Hours → integer quarter-units. Only valid on quarter-multiples. */
export function toQuarters(hours: number): number {
  return Math.round(hours * 4);
}

export function fromQuarters(quarters: number): number {
  return quarters / 4;
}

export function snapToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

export function isQuarterMultiple(hours: number): boolean {
  return Math.abs(hours * 4 - Math.round(hours * 4)) < 1e-9;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/** Entry hours: non-negative (explicit 0 is valid), quarter-hour multiples. */
export function validateEntryHours(hours: number): ValidationResult {
  if (!Number.isFinite(hours)) return { ok: false, reason: "Hours must be a number." };
  if (hours < 0) return { ok: false, reason: "Hours can't be negative." };
  if (!isQuarterMultiple(hours))
    return { ok: false, reason: "Hours must be in quarter-hour (0.25) steps." };
  return { ok: true };
}

/** Day cap: the sum of all entries on a day must stay ≤ 24h. `otherQuarters`
 *  is the day's total excluding the entry being added/edited. */
export function validateDayTotal(
  otherQuarters: number,
  candidateQuarters: number,
): ValidationResult {
  if (otherQuarters + candidateQuarters > MAX_DAY_QUARTERS) {
    const left = (MAX_DAY_QUARTERS - otherQuarters) / 4;
    return {
      ok: false,
      reason: `A day can hold at most 24 hours (${left} more available).`,
    };
  }
  return { ok: true };
}

/** Rates: non-negative, at most two decimal places. */
export function validateRate(rate: number): ValidationResult {
  if (!Number.isFinite(rate)) return { ok: false, reason: "Rate must be a number." };
  if (rate < 0) return { ok: false, reason: "Rate can't be negative." };
  if (Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-6)
    return { ok: false, reason: "Rate can have at most two decimal places." };
  return { ok: true };
}
