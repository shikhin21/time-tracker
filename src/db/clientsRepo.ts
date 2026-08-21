import { getDb, type BillerDetails, type ClientRow } from "./db";
import { newId } from "../lib/id";
import * as settingsRepo from "./settingsRepo";

/** The client a project bills to — one per project, so it's pre-filled each
 *  month rather than retyped. */
export async function getClient(projectId: string): Promise<ClientRow | null> {
  const db = await getDb();
  const rows = await db.select<ClientRow[]>("SELECT * FROM clients WHERE projectId = $1", [
    projectId,
  ]);
  return rows[0] ?? null;
}

export async function saveClient(input: {
  projectId: string;
  name: string;
  addressLines: string;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.execute(
    `INSERT INTO clients (id, projectId, name, addressLines, createdAt, updatedAt)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT(projectId) DO UPDATE SET
       name = excluded.name, addressLines = excluded.addressLines, updatedAt = excluded.updatedAt`,
    [newId(), input.projectId, input.name, input.addressLines, now],
  );
}

const EMPTY_BILLER: BillerDetails = { name: "", addressLines: "", phone: "" };

/** Biller details are app-level, not per-project, so they live in `settings`
 *  as JSON — no table of its own for a single row. */
export async function getBillerDetails(): Promise<BillerDetails> {
  const raw = await settingsRepo.getSetting(settingsRepo.BILLER_DETAILS);
  if (!raw) return EMPTY_BILLER;
  try {
    return { ...EMPTY_BILLER, ...(JSON.parse(raw) as Partial<BillerDetails>) };
  } catch {
    return EMPTY_BILLER; // corrupt value shouldn't block invoicing
  }
}

export async function saveBillerDetails(details: BillerDetails): Promise<void> {
  await settingsRepo.setSetting(settingsRepo.BILLER_DETAILS, JSON.stringify(details));
}
