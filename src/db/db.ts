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

// Must match the connection string registered with add_migrations in lib.rs —
// loading any other string opens a fresh, unmigrated database.
const DB_URL = "sqlite:timetracker.db";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  dbPromise ??= Database.load(DB_URL);
  return dbPromise;
}
