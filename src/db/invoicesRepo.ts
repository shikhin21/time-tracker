import { getDb, type InvoiceLineItemRow, type InvoiceRow } from "./db";
import { newId } from "../lib/id";
import type { InvoiceLine } from "../lib/invoice";

export interface InvoiceWithLines {
  invoice: InvoiceRow;
  lines: InvoiceLineItemRow[];
}

export async function getInvoices(projectId: string): Promise<InvoiceRow[]> {
  const db = await getDb();
  return db.select<InvoiceRow[]>(
    "SELECT * FROM invoices WHERE projectId = $1 ORDER BY createdAt DESC",
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

/** Invoices already covering this period — drives the already-invoiced warning
 *  (§7). Most recent first, so the newest supersedes in the message. */
export async function getInvoicesForPeriod(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<InvoiceRow[]> {
  const db = await getDb();
  return db.select<InvoiceRow[]>(
    `SELECT * FROM invoices
     WHERE projectId = $1 AND periodStart = $2 AND periodEnd = $3
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

/** Commits the snapshot. Called only on export (§7) — previewing must never
 *  reach here, or it would consume a number.
 *
 *  Header and lines are written in one transaction: a half-written invoice
 *  would both burn a number and print with missing lines. */
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

  await db.execute("BEGIN");
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
    for (const [i, line] of input.lines.entries()) {
      await db.execute(
        `INSERT INTO invoice_line_items (id, invoiceId, item, description, periodStart,
           periodEnd, hours, rate, amount, sortOrder)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
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
        ],
      );
    }
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
  return invoice;
}
