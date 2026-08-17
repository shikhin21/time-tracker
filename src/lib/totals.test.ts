import { describe, expect, it } from "vitest";
import { enUS } from "date-fns/locale";
import { isInMonth, monthGridWeeks } from "./dates";
import { sumByDay, sumForDays, sumForMonth, sumForYear, weekSplitTotals } from "./totals";

describe("sumByDay: blank vs explicit zero", () => {
  it("untouched day is absent; explicit-0 day is present at 0", () => {
    const totals = sumByDay([
      { date: "2026-08-17", hours: 2.5 },
      { date: "2026-08-17", hours: 0.25 },
      { date: "2026-08-18", hours: 0 },
    ]);
    expect(totals.get("2026-08-17")).toBe(11); // quarters
    expect(totals.get("2026-08-18")).toBe(0); // renders "0"
    expect(totals.has("2026-08-19")).toBe(false); // renders blank
  });
});

describe("rollups", () => {
  const totals = sumByDay([
    { date: "2026-08-30", hours: 2 },
    { date: "2026-08-31", hours: 3.5 },
    { date: "2026-09-01", hours: 1.25 },
    { date: "2026-09-02", hours: 0 },
    { date: "2025-12-31", hours: 4 },
  ]);

  it("sums by month and year", () => {
    expect(sumForMonth(totals, "2026-08")).toBe(22);
    expect(sumForMonth(totals, "2026-09")).toBe(5);
    expect(sumForYear(totals, 2026)).toBe(27);
    expect(sumForYear(totals, 2025)).toBe(16);
  });

  it("splits a straddling week by month, chronologically", () => {
    const splits = weekSplitTotals(totals, "2026-08-30");
    expect(splits).toEqual([
      { year: 2026, month: 8, monthKey: "2026-08", quarters: 22 },
      { year: 2026, month: 9, monthKey: "2026-09", quarters: 5 },
    ]);
  });

  it("§8 reconciliation: the week view's per-month subtotal equals the month view's in-month row total", () => {
    const straddleRow = monthGridWeeks(2026, 8, enUS)[5]; // Aug 30 – Sep 5
    const inMonthKeys = straddleRow.filter((k) => isInMonth(k, "2026-08"));
    const monthViewRowTotal = sumForDays(totals, inMonthKeys);
    const weekViewAugSplit = weekSplitTotals(totals, "2026-08-30")[0].quarters;
    expect(monthViewRowTotal).toBe(weekViewAugSplit);
  });
});
