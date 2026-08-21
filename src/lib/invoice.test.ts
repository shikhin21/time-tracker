import { describe, expect, it } from "vitest";
import { computeInvoice, nextInvoiceNumber } from "./invoice";
import type { RateLike } from "./rates";

const rate = (id: string, effectiveDate: string, value: number): RateLike => ({
  id,
  effectiveDate,
  rate: value,
});

describe("computeInvoice: rate-period grouping", () => {
  it("collapses a month with no rate change into a single line", () => {
    const result = computeInvoice(
      [
        { date: "2026-07-02", hours: 8 },
        { date: "2026-07-15", hours: 4 },
        { date: "2026-07-31", hours: 3 },
      ],
      [rate("r1", "2026-01-01", 50)],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ hours: 15, rate: 50, amount: 750 });
    expect(result.subtotal).toBe(750);
    expect(result.amountDue).toBe(750);
  });

  it("splits into one line per rate-period when the rate changes mid-month", () => {
    const result = computeInvoice(
      [
        { date: "2026-07-05", hours: 10 }, // @50
        { date: "2026-07-14", hours: 2 }, // @50 (day before the change)
        { date: "2026-07-15", hours: 6 }, // @60 (change takes effect)
        { date: "2026-07-20", hours: 4 }, // @60
      ],
      [rate("r1", "2026-01-01", 50), rate("r2", "2026-07-15", 60)],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ hours: 12, rate: 50, amount: 600 });
    expect(result.lines[1]).toMatchObject({ hours: 10, rate: 60, amount: 600 });
    expect(result.subtotal).toBe(1200);
  });

  it("orders lines chronologically and describes each by its worked span", () => {
    const result = computeInvoice(
      [
        { date: "2026-07-20", hours: 1 },
        { date: "2026-07-03", hours: 1 },
      ],
      [rate("r1", "2026-01-01", 50), rate("r2", "2026-07-15", 60)],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result.lines.map((l) => l.description)).toEqual([
      "For services rendered from 2026-07-03 to 2026-07-03",
      "For services rendered from 2026-07-20 to 2026-07-20",
    ]);
  });

  it("ignores entries outside the billed period", () => {
    const result = computeInvoice(
      [
        { date: "2026-06-30", hours: 8 },
        { date: "2026-07-10", hours: 5 },
        { date: "2026-08-01", hours: 8 },
      ],
      [rate("r1", "2026-01-01", 50)],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].hours).toBe(5);
  });

  it("produces no line for a rate-period with no hours logged", () => {
    const result = computeInvoice(
      [{ date: "2026-07-05", hours: 4 }],
      [rate("r1", "2026-01-01", 50), rate("r2", "2026-07-15", 60)],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].rate).toBe(50);
  });

  it("reports days before the first rate as unbillable instead of billing them at 0", () => {
    const result = computeInvoice(
      [
        { date: "2026-07-02", hours: 6 }, // no rate yet
        { date: "2026-07-20", hours: 4 }, // @60
      ],
      [rate("r2", "2026-07-15", 60)],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result.unratedDates).toEqual(["2026-07-02"]);
    expect(result.unratedHours).toBe(6);
    expect(result.lines).toHaveLength(1);
    expect(result.subtotal).toBe(240);
  });

  it("keeps quarter-hour precision and rounds money to cents", () => {
    const result = computeInvoice(
      [
        { date: "2026-07-02", hours: 3.25 },
        { date: "2026-07-03", hours: 0.25 },
      ],
      [rate("r1", "2026-01-01", 33.33)],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result.lines[0].hours).toBe(3.5);
    expect(result.lines[0].amount).toBe(116.66); // 3.5 × 33.33 = 116.655
    expect(result.subtotal).toBe(116.66);
  });

  it("is empty, not broken, for a month with no entries", () => {
    const result = computeInvoice([], [rate("r1", "2026-01-01", 50)], "2026-07-01", "2026-07-31");
    expect(result.lines).toEqual([]);
    expect(result.subtotal).toBe(0);
    expect(result.amountDue).toBe(0);
  });

  it("carries tax and payments at 0 so total and amount due follow the subtotal", () => {
    const result = computeInvoice(
      [{ date: "2026-07-02", hours: 2 }],
      [rate("r1", "2026-01-01", 50)],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result).toMatchObject({ salesTax: 0, payments: 0, total: 100, amountDue: 100 });
  });
});

describe("nextInvoiceNumber", () => {
  it("returns null for a project that has never been invoiced", () => {
    expect(nextInvoiceNumber([])).toBeNull();
  });

  it("increments the highest number used, preserving leading-zero width", () => {
    expect(nextInvoiceNumber(["036"])).toBe("037");
    expect(nextInvoiceNumber(["036", "037", "038"])).toBe("039");
    expect(nextInvoiceNumber(["099"])).toBe("100");
  });

  it("goes by highest, not most recent, so an out-of-order entry can't reissue a number", () => {
    expect(nextInvoiceNumber(["040", "012"])).toBe("041");
  });

  it("ignores non-numeric numbers rather than throwing", () => {
    expect(nextInvoiceNumber(["036", "DRAFT"])).toBe("037");
    expect(nextInvoiceNumber(["DRAFT"])).toBeNull();
  });
});
