import Database from "@tauri-apps/plugin-sql";

export interface ProjectRow {
  id: string;
  name: string;
  color: string; // palette token name
  createdAt: number;
  updatedAt: number;
}

export interface EntryRow {
  id: string;
  projectId: string;
  date: string; // "YYYY-MM-DD"
  hours: number;
  task: string | null;
  loggedAt: number; // epoch ms — when the entry was logged; unchanged by edits
  createdAt: number;
  updatedAt: number;
}

export interface RateRow {
  id: string;
  projectId: string;
  effectiveDate: string; // "YYYY-MM-DD"
  rate: number;
  createdAt: number;
  updatedAt: number;
}

export interface ClientRow {
  id: string;
  projectId: string;
  name: string;
  addressLines: string; // multi-line billing address block
  createdAt: number;
  updatedAt: number;
}

/** Biller ("from") details, stored app-level in `settings` as JSON. */
export interface BillerDetails {
  name: string;
  addressLines: string;
  phone: string;
}

export interface InvoiceRow {
  id: string;
  projectId: string;
  number: string;
  invoiceDate: string; // "YYYY-MM-DD"
  periodStart: string; // "YYYY-MM-DD"
  periodEnd: string; // "YYYY-MM-DD"
  subtotal: number;
  salesTax: number;
  total: number;
  payments: number;
  amountDue: number;
  /** JSON — the biller/client blocks as they were when the invoice issued, so
   *  the invoice reprints identically no matter what changes later. */
  fromSnapshot: string;
  clientSnapshot: string;
  createdAt: number;
  updatedAt: number;
}

export interface InvoiceLineItemRow {
  id: string;
  invoiceId: string;
  item: string;
  description: string;
  periodStart: string; // "YYYY-MM-DD"
  periodEnd: string;
  hours: number;
  rate: number;
  amount: number;
  sortOrder: number;
}

// Must match the connection string registered with add_migrations in lib.rs —
// loading any other string opens a fresh, unmigrated database.
const DB_URL = "sqlite:timetracker.db";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  dbPromise ??= Database.load(DB_URL);
  return dbPromise;
}
