import { describe, expect, it } from "vitest";
import { enUS } from "date-fns/locale";
import {
  formatHoursLabel,
  formatLoggedAt,
  formatQuarters,
  formatRate,
  formatWeekSplitLabel,
} from "./format";

describe("hours and rate formatting", () => {
  it("formats quarters compactly", () => {
    expect(formatQuarters(50)).toBe("12.5");
    expect(formatQuarters(1)).toBe("0.25");
    expect(formatQuarters(24)).toBe("6");
    expect(formatQuarters(0)).toBe("0");
    expect(formatHoursLabel(50)).toBe("12.5h");
  });

  it("formats rates with two decimals and $", () => {
    expect(formatRate(85)).toBe("$85.00");
    expect(formatRate(87.5)).toBe("$87.50");
    expect(formatRate(0)).toBe("$0.00");
  });
});

describe("formatLoggedAt", () => {
  it("time only when logged on the entry's own day", () => {
    const ms = new Date(2026, 7, 18, 14, 31).getTime();
    expect(formatLoggedAt(ms, "2026-08-18", enUS)).toBe("2:31 PM");
  });

  it("date + time when backfilled from another day", () => {
    const ms = new Date(2026, 7, 18, 14, 31).getTime();
    expect(formatLoggedAt(ms, "2026-08-17", enUS)).toBe("Aug 18, 2:31 PM");
  });

  it("adds the year across a year boundary", () => {
    const ms = new Date(2027, 0, 2, 9, 5).getTime();
    expect(formatLoggedAt(ms, "2026-12-31", enUS)).toBe("Jan 2, 2027, 9:05 AM");
  });
});

describe("week split labels", () => {
  it("omits years within one year", () => {
    const label = formatWeekSplitLabel(
      [
        { year: 2026, month: 8, monthKey: "2026-08", quarters: 22 },
        { year: 2026, month: 9, monthKey: "2026-09", quarters: 5 },
      ],
      enUS,
    );
    expect(label).toBe("Aug: 5.5h · Sep: 1.25h");
  });

  it("includes years across a year boundary", () => {
    const label = formatWeekSplitLabel(
      [
        { year: 2026, month: 12, monthKey: "2026-12", quarters: 50 },
        { year: 2027, month: 1, monthKey: "2027-01", quarters: 24 },
      ],
      enUS,
    );
    expect(label).toBe("Dec 2026: 12.5h · Jan 2027: 6h");
  });
});
