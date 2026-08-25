import type { BillerDetails, InvoiceLineItemRow, InvoiceRow } from "../db/db";
import { monthEndKey } from "../lib/dates";
import { formatAmount, formatInvoiceDate, type InvoiceLine } from "../lib/invoice";

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
  /** The page title. Grey and unbolded on purpose: it names the document
   *  without competing with the biller's name or the amount due, which are
   *  what the weight on this sheet is reserved for. */
  title: { fontSizePt: 26, trackingPt: 3, color: "#8A8A8A", spaceAfterPt: 18 },
  /** Only the item table is ruled; the header and totals blocks are borderless.
   *  Vertical rhythm, in points/px — the two units coincide at 96dpi for the
   *  preview and are points in the PDF. */
  space: { billTo: 24, beforeTotals: 28, metaGap: 6 },
} as const;

const TOTAL_TWIPS = 9360;

export function pct(cols: readonly number[]): string[] {
  return cols.map((c) => `${((c / TOTAL_TWIPS) * 100).toFixed(4)}%`);
}

const DATE_TOKEN = /^\d{2}-\d{2}-\d{4}$/;

/** Split text into runs, flagging mm-dd-yyyy dates. Both a browser and a PDF
 *  layout engine treat a hyphen as a place they may break a line, which splits
 *  "07-01-2026" across two lines; flagging the dates lets a renderer keep each
 *  one whole. */
export function splitOnDates(text: string): { text: string; isDate: boolean }[] {
  return text
    .split(/(\d{2}-\d{2}-\d{4})/)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, isDate: DATE_TOKEN.test(part) }));
}

export interface LabelledRow {
  label: string;
  value: string;
  /** Printed bold — the one figure meant to draw the eye. */
  emphasised: boolean;
}

/** The invoice metadata block, top right. Defined here so the preview and the
 *  PDF label and order it identically; each only decides how to lay it out. */
export function metaRows(doc: InvoiceDoc): LabelledRow[] {
  return [
    { label: "Invoice #:", value: doc.number, emphasised: false },
    {
      label: "Invoice Date (mm-dd-yyyy):",
      value: formatInvoiceDate(doc.invoiceDate),
      emphasised: false,
    },
    {
      label: "Invoice Period (mm-dd-yyyy):",
      value: `${formatInvoiceDate(doc.periodStart)} to ${formatInvoiceDate(doc.periodEnd)}`,
      emphasised: false,
    },
    {
      label: "Amount Due:",
      value: `$${formatAmount(doc.amountDue)}`,
      emphasised: true,
    },
  ];
}

export interface TotalsRow {
  label: string;
  amount: number;
  /** The bottom line — the only amount printed bold. */
  emphasised: boolean;
}

/** The totals block, in print order. */
export function totalsRows(doc: InvoiceDoc): TotalsRow[] {
  return [
    { label: "Subtotal", amount: doc.subtotal, emphasised: false },
    { label: "Sales Tax", amount: doc.salesTax, emphasised: false },
    { label: "Total", amount: doc.total, emphasised: false },
    { label: "Payments", amount: doc.payments, emphasised: false },
    { label: "Amount Due", amount: doc.amountDue, emphasised: true },
  ];
}

// Fixed English abbreviations rather than the active locale: an invoice is
// already locale-independent (mm-dd-yyyy throughout), and a filename shouldn't
// change shape with the app's language.
const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const yearOfKey = (dateKey: string) => dateKey.slice(0, 4);
const monthAbbreviation = (dateKey: string) =>
  MONTH_ABBREVIATIONS[Number(dateKey.slice(5, 7)) - 1];
const dayOfKey = (dateKey: string) => Number(dateKey.slice(8, 10));

/** Runs from a month's first day to its last, so the period can be named by
 *  the month alone. */
export function coversWholeMonth(periodStart: string, periodEnd: string): boolean {
  return (
    dayOfKey(periodStart) === 1 && periodEnd === monthEndKey(periodStart.slice(0, 7))
  );
}

/** "Jul 2026" for a whole month, "1 Jul 2026 to 10 Jul 2026" for anything
 *  else — the dates are only spelled out when a month's name wouldn't describe
 *  the period. Names the file, and labels a row in the invoices list. */
export function describeInvoicePeriod(periodStart: string, periodEnd: string): string {
  const day = (key: string) =>
    `${dayOfKey(key)} ${monthAbbreviation(key)} ${yearOfKey(key)}`;
  return coversWholeMonth(periodStart, periodEnd)
    ? `${monthAbbreviation(periodStart)} ${yearOfKey(periodStart)}`
    : `${day(periodStart)} to ${day(periodEnd)}`;
}

/** `Invoice036 - Jul 2026.pdf`, or `Invoice036 - 1 Jul 2026 to 10 Jul 2026.pdf`
 *  when the period isn't a whole month. */
export function invoiceFilename(doc: InvoiceDoc): string {
  return `Invoice${doc.number.trim()} - ${describeInvoicePeriod(doc.periodStart, doc.periodEnd)}.pdf`;
}
