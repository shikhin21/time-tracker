import type { BillerDetails, InvoiceLineItemRow, InvoiceRow } from "../db/db";
import type { InvoiceLine } from "../lib/invoice";

export interface InvoiceParty {
  name: string;
  addressLines: string;
  phone?: string;
}

/** Everything printed on an invoice, resolved. Both renderers (HTML preview
 *  and PDF) take exactly this, so neither can show a field the other doesn't. */
export interface InvoiceDoc {
  from: InvoiceParty;
  client: InvoiceParty;
  number: string;
  invoiceDate: string; // "YYYY-MM-DD"
  periodStart: string;
  periodEnd: string;
  lines: InvoiceLine[];
  subtotal: number;
  salesTax: number;
  total: number;
  payments: number;
  amountDue: number;
}

export function billerToParty(biller: BillerDetails): InvoiceParty {
  return { name: biller.name, addressLines: biller.addressLines, phone: biller.phone };
}

/** Rebuild a printable doc from a stored invoice — reads only the invoice's own
 *  rows, never `entries` or `rates`, which is what makes a reprint identical to
 *  the original however much the underlying data has moved on. */
export function docFromStoredInvoice(
  invoice: InvoiceRow,
  lines: InvoiceLineItemRow[],
): InvoiceDoc {
  const parse = (json: string): InvoiceParty => {
    try {
      return JSON.parse(json) as InvoiceParty;
    } catch {
      return { name: "", addressLines: "" };
    }
  };
  return {
    from: parse(invoice.fromSnapshot),
    client: parse(invoice.clientSnapshot),
    number: invoice.number,
    invoiceDate: invoice.invoiceDate,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    lines: lines.map((l) => ({
      item: l.item,
      description: l.description,
      periodStart: l.periodStart,
      periodEnd: l.periodEnd,
      hours: l.hours,
      rate: l.rate,
      amount: l.amount,
    })),
    subtotal: invoice.subtotal,
    salesTax: invoice.salesTax,
    total: invoice.total,
    payments: invoice.payments,
    amountDue: invoice.amountDue,
  };
}

export function addressLinesOf(party: InvoiceParty): string[] {
  return party.addressLines.split("\n").filter((l) => l.trim() !== "");
}

/** Column proportions and colors taken from Invoice-sample.docx, where every
 *  table spans 9360 twips (6.5" — US Letter with 1" margins). Shared by both
 *  renderers so the preview and the PDF stay laid out identically. */
export const LAYOUT = {
  page: { paddingIn: 1 },
  /** Header table: biller block | invoice meta block. */
  headerCols: [3744, 5616],
  /** Item, Description, Hours worked, Hourly rate ($), Amount ($). */
  itemCols: [1800, 2800, 1200, 1400, 2160],
  /** Spacer | label | value. */
  totalsCols: [6084, 1872, 1404],
  headerFill: "#d9e2f3",
  border: "#000000",
  fontSizePt: 10,
  nameFontSizePt: 12,
} as const;

const TOTAL_TWIPS = 9360;

export function pct(cols: readonly number[]): string[] {
  return cols.map((c) => `${((c / TOTAL_TWIPS) * 100).toFixed(4)}%`);
}

/** The totals block, in print order. */
export function totalsRows(doc: InvoiceDoc): { label: string; amount: number }[] {
  return [
    { label: "Subtotal", amount: doc.subtotal },
    { label: "Sales Tax", amount: doc.salesTax },
    { label: "Total", amount: doc.total },
    { label: "Payments", amount: doc.payments },
    { label: "Amount Due", amount: doc.amountDue },
  ];
}

/** `Invoice-036-CentreForAppliedEthicsLtd-2026-07.pdf` — number first so a
 *  folder of invoices sorts by sequence. The client name is title-cased into
 *  one word, which stays readable where a raw strip would run words together
 *  in mixed case. */
export function invoiceFilename(doc: InvoiceDoc): string {
  const client =
    doc.client.name
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join("") || "Client";
  const period = doc.periodStart.slice(0, 7);
  return `Invoice-${doc.number}-${client}-${period}.pdf`;
}
