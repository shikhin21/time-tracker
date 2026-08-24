import { describe, expect, it } from "vitest";
import type { InvoiceLineItemRow, InvoiceRow } from "../db/db";
import {
  addressLinesOf,
  docFromStoredInvoice,
  invoiceFilename,
  pct,
  totalsRows,
  type InvoiceDoc,
} from "./invoiceModel";

const doc: InvoiceDoc = {
  from: { name: "FNU Shikhin", addressLines: "110 Brook Hollow Ct\nCary, NC 27513", phone: "x" },
  client: { name: "Centre for Applied Ethics Ltd", addressLines: "86-90 Paul Street\nLondon" },
  number: "036",
  invoiceDate: "2026-08-07",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  lines: [],
  subtotal: 3360,
  salesTax: 0,
  total: 3360,
  payments: 0,
  amountDue: 3360,
};

describe("invoiceFilename", () => {
  it("leads with the number so a folder sorts by sequence", () => {
    expect(invoiceFilename(doc)).toBe("Invoice-036-CentreForAppliedEthicsLtd-2026-07.pdf");
  });

  it("strips characters that don't belong in a filename", () => {
    const awkward = { ...doc, client: { ...doc.client, name: "A/B: Ltd. & Co" } };
    expect(invoiceFilename(awkward)).toBe("Invoice-036-ABLtdCo-2026-07.pdf");
  });

  it("falls back to 'Client' when no client name is set", () => {
    const nameless = { ...doc, client: { ...doc.client, name: "  " } };
    expect(invoiceFilename(nameless)).toBe("Invoice-036-Client-2026-07.pdf");
  });
});

describe("addressLinesOf", () => {
  it("splits on newlines and drops blank lines", () => {
    expect(addressLinesOf({ name: "x", addressLines: "a\n\n  \nb" })).toEqual(["a", "b"]);
  });
});

describe("layout", () => {
  it("turns the sample's twip column widths into percentages that total 100", () => {
    const widths = pct([1800, 2800, 1200, 1400, 2160]);
    const sum = widths.reduce((s, w) => s + parseFloat(w), 0);
    expect(Math.round(sum)).toBe(100);
  });

  it("prints the totals block in the sample's order", () => {
    expect(totalsRows(doc).map((r) => r.label)).toEqual([
      "Subtotal",
      "Sales Tax",
      "Total",
      "Payments",
      "Amount Due",
    ]);
  });

  it("emphasises the bottom line only", () => {
    expect(totalsRows(doc).filter((r) => r.emphasised).map((r) => r.label)).toEqual([
      "Amount Due",
    ]);
  });
});

describe("docFromStoredInvoice", () => {
  const stored: InvoiceRow = {
    id: "i1",
    projectId: "p1",
    number: "036",
    invoiceDate: "2026-08-07",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    subtotal: 3360,
    salesTax: 0,
    total: 3360,
    payments: 0,
    amountDue: 3360,
    fromSnapshot: JSON.stringify({ name: "FNU Shikhin", addressLines: "110 Brook Hollow Ct" }),
    clientSnapshot: JSON.stringify({ name: "Centre for Applied Ethics Ltd", addressLines: "UK" }),
    createdAt: 1,
    updatedAt: 1,
  };
  const line: InvoiceLineItemRow = {
    id: "l1",
    invoiceId: "i1",
    item: "Software services",
    description: "For services rendered from 07-01-2026 to 07-31-2026",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    hours: 64,
    rate: 52.5,
    amount: 3360,
    sortOrder: 0,
  };

  it("reprints from the invoice's own rows, not from entries or rates", () => {
    const rebuilt = docFromStoredInvoice(stored, [line]);
    expect(rebuilt.from.name).toBe("FNU Shikhin");
    expect(rebuilt.client.name).toBe("Centre for Applied Ethics Ltd");
    expect(rebuilt.lines).toEqual([
      {
        item: "Software services",
        description: "For services rendered from 07-01-2026 to 07-31-2026",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        hours: 64,
        rate: 52.5,
        amount: 3360,
      },
    ]);
    expect(rebuilt.amountDue).toBe(3360);
  });

  it("survives a corrupt snapshot rather than failing to open the invoice", () => {
    const rebuilt = docFromStoredInvoice({ ...stored, clientSnapshot: "{oops" }, []);
    expect(rebuilt.client).toEqual({ name: "", addressLines: "" });
    expect(rebuilt.number).toBe("036");
  });
});
