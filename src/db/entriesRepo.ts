import { getDb, type EntryRow } from "./db";
import { ValidationError } from "../lib/errors";
import { newId } from "../lib/id";
import {
  toQuarters,
  validateDayTotal,
  validateEntryHours,
} from "../lib/validation";

export async function getEntriesInRange(
  projectId: string,
  fromKey: string,
  toKey: string,
): Promise<EntryRow[]> {
  const db = await getDb();
  return db.select<EntryRow[]>(
    "SELECT * FROM entries WHERE projectId = $1 AND date BETWEEN $2 AND $3 ORDER BY date, createdAt",
    [projectId, fromKey, toKey],
  );
}

export async function getEntriesForDay(
  projectId: string,
  dateKey: string,
): Promise<EntryRow[]> {
  const db = await getDb();
  return db.select<EntryRow[]>(
    "SELECT * FROM entries WHERE projectId = $1 AND date = $2 ORDER BY createdAt",
    [projectId, dateKey],
  );
}

/** Re-validates against the day's other entries at the repo layer so no code
 *  path can bypass the quarter-step / non-negative / ≤24h invariants. */
async function assertValid(
  projectId: string,
  dateKey: string,
  hours: number,
  excludeEntryId: string | null,
): Promise<void> {
  const hoursCheck = validateEntryHours(hours);
  if (!hoursCheck.ok) throw new ValidationError(hoursCheck.reason);
  const siblings = await getEntriesForDay(projectId, dateKey);
  const otherQuarters = siblings
    .filter((e) => e.id !== excludeEntryId)
    .reduce((sum, e) => sum + toQuarters(e.hours), 0);
  const dayCheck = validateDayTotal(otherQuarters, toQuarters(hours));
  if (!dayCheck.ok) throw new ValidationError(dayCheck.reason);
}

export async function addEntry(input: {
  projectId: string;
  date: string;
  hours: number;
  task: string | null;
}): Promise<EntryRow> {
  await assertValid(input.projectId, input.date, input.hours, null);
  const db = await getDb();
  const now = Date.now();
  const entry: EntryRow = {
    id: newId(),
    projectId: input.projectId,
    date: input.date,
    hours: input.hours,
    task: input.task,
    createdAt: now,
    updatedAt: now,
  };
  await db.execute(
    "INSERT INTO entries (id, projectId, date, hours, task, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [entry.id, entry.projectId, entry.date, entry.hours, entry.task, now, now],
  );
  return entry;
}

export async function updateEntry(
  id: string,
  patch: { hours?: number; task?: string | null },
): Promise<void> {
  const db = await getDb();
  const rows = await db.select<EntryRow[]>("SELECT * FROM entries WHERE id = $1", [id]);
  const existing = rows[0];
  if (!existing) throw new ValidationError("Entry no longer exists.");
  const hours = patch.hours ?? existing.hours;
  await assertValid(existing.projectId, existing.date, hours, id);
  await db.execute(
    "UPDATE entries SET hours = $1, task = $2, updatedAt = $3 WHERE id = $4",
    [hours, patch.task !== undefined ? patch.task : existing.task, Date.now(), id],
  );
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM entries WHERE id = $1", [id]);
}

/** Distinct previous task labels for a project, most recently used first —
 *  the type-ahead suggestion pool. */
export async function getDistinctTasks(projectId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ task: string }[]>(
    "SELECT task FROM entries WHERE projectId = $1 AND task IS NOT NULL AND task != '' GROUP BY task ORDER BY MAX(createdAt) DESC",
    [projectId],
  );
  return rows.map((r) => r.task);
}
