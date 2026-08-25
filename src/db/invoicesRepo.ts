import { getDb, type InvoiceLineItemRow, type InvoiceRow } from "./db";
import { ValidationError } from "../lib/errors";
import { newId } from "../lib/id";
import type { InvoiceLine } from "../lib/invoice";

export interface InvoiceWithLines {
  invoice: InvoiceRow;
  lines: InvoiceLineItemRow[];
}

/** Newest first — by the date on the invoice rather than when the row was
 *  written, so the list reads in the order the invoices were issued even if one
 *  was recorded late or backdated. */
export async function getInvoices(projectId: string): Promise<InvoiceRow[]> {
  const db = await getDb();
  return db.select<InvoiceRow[]>(
    "SELECT * FROM invoices WHERE projectId = $1 ORDER BY invoiceDate DESC, createdAt DESC",
    [projectId],
  );
}

/** Every number this project has issued — the input to nextInvoiceNumber, so
 *  the sequence is derived from the ledger rather than a counter that drifts. */
export async function getInvoiceNumbers(projectId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ number: string }[]>(
    "SELECT number FROM invoices WHERE projectId = $1",
    [projectId],
  );
  return rows.map((r) => r.number);
}

/** Invoices whose period touches this one at all — the same period exactly, or
 *  any partial overlap. Drives the already-invoiced and overlap warnings (§7).
 *
 *  Two ranges overlap unless one ends before the other starts; date keys are
 *  "YYYY-MM-DD", so string comparison orders them correctly. Most recent first,
 *  so the newest is the one named in the message. */
export async function getOverlappingInvoices(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<InvoiceRow[]> {
  const db = await getDb();
  return db.select<InvoiceRow[]>(
    `SELECT * FROM invoices
     WHERE projectId = $1 AND periodStart <= $3 AND periodEnd >= $2
     ORDER BY createdAt DESC`,
    [projectId, periodStart, periodEnd],
  );
}

export async function getInvoiceWithLines(invoiceId: string): Promise<InvoiceWithLines | null> {
  const db = await getDb();
  const invoices = await db.select<InvoiceRow[]>("SELECT * FROM invoices WHERE id = $1", [
    invoiceId,
  ]);
  if (!invoices[0]) return null;
  const lines = await db.select<InvoiceLineItemRow[]>(
    "SELECT * FROM invoice_line_items WHERE invoiceId = $1 ORDER BY sortOrder",
    [invoiceId],
  );
  return { invoice: invoices[0], lines };
}

export interface CreateInvoiceInput {
  projectId: string;
  number: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  salesTax: number;
  total: number;
  payments: number;
  amountDue: number;
  fromSnapshot: string;
  clientSnapshot: string;
  lines: InvoiceLine[];
}

const LINE_COLUMNS = 10;

/** Commits the snapshot. Called only on export (§7) — previewing must never
 *  reach here, or it would consume a number.
 *
 *  There is no transaction, because there can't be one: tauri-plugin-sql runs
 *  every execute() on a connection taken from a pool, so BEGIN, the inserts and
 *  COMMIT each land on a different connection — the inserts auto-commit and the
 *  COMMIT fails with no transaction active.
 *
 *  Instead the write is two statements, each atomic in SQLite on its own: the
 *  header, then every line in a single multi-row insert. If the lines fail, the
 *  header is deleted, since an invoice with no lines would both burn a number
 *  and print blank. */
export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceRow> {
  const db = await getDb();
  const now = Date.now();
  const invoice: InvoiceRow = {
    id: newId(),
    projectId: input.projectId,
    number: input.number,
    invoiceDate: input.invoiceDate,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    subtotal: input.subtotal,
    salesTax: input.salesTax,
    total: input.total,
    payments: input.payments,
    amountDue: input.amountDue,
    fromSnapshot: input.fromSnapshot,
    clientSnapshot: input.clientSnapshot,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.execute(
      `INSERT INTO invoices (id, projectId, number, invoiceDate, periodStart, periodEnd,
         subtotal, salesTax, total, payments, amountDue, fromSnapshot, clientSnapshot,
         createdAt, updatedAt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
      [
        invoice.id,
        invoice.projectId,
        invoice.number,
        invoice.invoiceDate,
        invoice.periodStart,
        invoice.periodEnd,
        invoice.subtotal,
        invoice.salesTax,
        invoice.total,
        invoice.payments,
        invoice.amountDue,
        invoice.fromSnapshot,
        invoice.clientSnapshot,
        now,
      ],
    );
  } catch (e) {
    // the unique index is the backstop; the generator blocks this earlier
    if (String(e).includes("UNIQUE") && String(e).includes("number")) {
      throw new ValidationError(
        `Invoice #${invoice.number} already exists for this project. Use a different number.`,
      );
    }
    throw e;
  }

  if (input.lines.length > 0) {
    const rows = input.lines
      .map(
        (_, i) =>
          `(${Array.from(
            { length: LINE_COLUMNS },
            (_, column) => `$${i * LINE_COLUMNS + column + 1}`,
          ).join(",")})`,
      )
      .join(",");
    const values = input.lines.flatMap((line, i) => [
      newId(),
      invoice.id,
      line.item,
      line.description,
      line.periodStart,
      line.periodEnd,
      line.hours,
      line.rate,
      line.amount,
      i,
    ]);
    try {
      await db.execute(
        `INSERT INTO invoice_line_items (id, invoiceId, item, description, periodStart,
           periodEnd, hours, rate, amount, sortOrder)
         VALUES ${rows}`,
        values,
      );
    } catch (e) {
      // don't leave a numbered invoice that would print with no lines
      await db.execute("DELETE FROM invoices WHERE id = $1", [invoice.id]).catch(() => {});
      throw e;
    }
  }
  return invoice;
}
