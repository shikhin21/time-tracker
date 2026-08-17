import { getDb, type RateRow } from "./db";
import { newId } from "../lib/id";
import { checkRateDateConflict, type CountEntriesFn } from "../lib/rates";
import { validateRate } from "../lib/validation";
import { ValidationError } from "./entriesRepo";

export class RateDateConflictError extends Error {}

export async function getRates(projectId: string): Promise<RateRow[]> {
  const db = await getDb();
  return db.select<RateRow[]>(
    "SELECT * FROM rates WHERE projectId = $1 ORDER BY effectiveDate",
    [projectId],
  );
}

function assertRateValue(rate: number): void {
  const check = validateRate(rate);
  if (!check.ok) throw new ValidationError(check.reason);
}

export async function addRate(input: {
  projectId: string;
  effectiveDate: string;
  rate: number;
}): Promise<RateRow> {
  assertRateValue(input.rate);
  const existing = await getRates(input.projectId);
  const conflict = checkRateDateConflict(existing, {
    type: "add",
    effectiveDate: input.effectiveDate,
    rate: input.rate,
  });
  if (conflict) throw new RateDateConflictError(conflict);
  const db = await getDb();
  const now = Date.now();
  const row: RateRow = {
    id: newId(),
    projectId: input.projectId,
    effectiveDate: input.effectiveDate,
    rate: input.rate,
    createdAt: now,
    updatedAt: now,
  };
  await db.execute(
    "INSERT INTO rates (id, projectId, effectiveDate, rate, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6)",
    [row.id, row.projectId, row.effectiveDate, row.rate, now, now],
  );
  return row;
}

export async function updateRate(
  id: string,
  patch: { rate?: number; effectiveDate?: string },
): Promise<void> {
  const db = await getDb();
  const rows = await db.select<RateRow[]>("SELECT * FROM rates WHERE id = $1", [id]);
  const existing = rows[0];
  if (!existing) throw new ValidationError("Rate no longer exists.");
  const rate = patch.rate ?? existing.rate;
  assertRateValue(rate);
  if (patch.effectiveDate !== undefined && patch.effectiveDate !== existing.effectiveDate) {
    const siblings = await getRates(existing.projectId);
    const conflict = checkRateDateConflict(siblings, {
      type: "edit-date",
      rateId: id,
      newEffectiveDate: patch.effectiveDate,
    });
    if (conflict) throw new RateDateConflictError(conflict);
  }
  await db.execute(
    "UPDATE rates SET rate = $1, effectiveDate = $2, updatedAt = $3 WHERE id = $4",
    [rate, patch.effectiveDate ?? existing.effectiveDate, Date.now(), id],
  );
}

export async function deleteRate(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM rates WHERE id = $1", [id]);
}

/** Entry counter over a date span, for the rate-impact preview. Queried
 *  directly (not from UI-loaded ranges) so the count is always exact. */
export function makeEntryCounter(projectId: string): CountEntriesFn {
  return async (fromDate, toDateOrNull) => {
    const db = await getDb();
    const rows =
      toDateOrNull === null
        ? await db.select<{ count: number; minDate: string | null; maxDate: string | null }[]>(
            "SELECT COUNT(*) as count, MIN(date) as minDate, MAX(date) as maxDate FROM entries WHERE projectId = $1 AND date >= $2",
            [projectId, fromDate],
          )
        : await db.select<{ count: number; minDate: string | null; maxDate: string | null }[]>(
            "SELECT COUNT(*) as count, MIN(date) as minDate, MAX(date) as maxDate FROM entries WHERE projectId = $1 AND date >= $2 AND date <= $3",
            [projectId, fromDate, toDateOrNull],
          );
    return rows[0] ?? { count: 0, minDate: null, maxDate: null };
  };
}
