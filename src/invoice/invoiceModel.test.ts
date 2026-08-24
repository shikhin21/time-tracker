import { describe, expect, it } from "vitest";
import type { InvoiceLineItemRow, InvoiceRow } from "../db/db";
import {
  addressLinesOf,
  docFromStoredInvoice,
  invoiceFilename,
  pct,
  splitOnDates,
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
  const forPeriod = (periodStart: string, periodEnd: string) =>
    invoiceFilename({ ...doc, periodStart, periodEnd });

  it("names a whole month by the month alone", () => {
    expect(forPeriod("2026-07-01", "2026-07-31")).toBe("Invoice036 - Jul 2026.pdf");
  });

  it("spells out the dates for part of a month", () => {
    expect(forPeriod("2026-07-01", "2026-07-10")).toBe(
      "Invoice036 - 1 Jul 2026 to 10 Jul 2026.pdf",
    );
  });

  it("spells out the dates for a span crossing months", () => {
    expect(forPeriod("2026-07-15", "2026-08-14")).toBe(
      "Invoice036 - 15 Jul 2026 to 14 Aug 2026.pdf",
    );
  });

  it("recognises a whole month of any length", () => {
    expect(forPeriod("2026-02-01", "2026-02-28")).toBe("Invoice036 - Feb 2026.pdf");
    expect(forPeriod("2028-02-01", "2028-02-29")).toBe("Invoice036 - Feb 2028.pdf");
    expect(forPeriod("2026-09-01", "2026-09-30")).toBe("Invoice036 - Sep 2026.pdf");
  });

  it("doesn't call a month whole when a day is missing from either end", () => {
    expect(forPeriod("2026-07-02", "2026-07-31")).toContain(" to ");
    expect(forPeriod("2026-07-01", "2026-07-30")).toContain(" to ");
    expect(forPeriod("2026-02-01", "2026-02-29")).toContain(" to "); // 2026 isn't a leap year
  });

  it("drops leading zeros from the day, keeping them in the invoice number", () => {
    expect(forPeriod("2026-07-05", "2026-07-09")).toBe(
      "Invoice036 - 5 Jul 2026 to 9 Jul 2026.pdf",
    );
  });
});

describe("splitOnDates", () => {
  it("isolates each date so it can be kept whole", () => {
    expect(splitOnDates("For services rendered from 07-01-2026 to 07-31-2026")).toEqual([
      { text: "For services rendered from ", isDate: false },
      { text: "07-01-2026", isDate: true },
      { text: " to ", isDate: false },
      { text: "07-31-2026", isDate: true },
    ]);
  });

  it("leaves text with no dates as a single run", () => {
    expect(splitOnDates("Software services")).toEqual([
      { text: "Software services", isDate: false },
    ]);
  });

  it("doesn't mistake other hyphenated numbers for dates", () => {
    expect(splitOnDates("ref 12-34").every((p) => !p.isDate)).toBe(true);
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
