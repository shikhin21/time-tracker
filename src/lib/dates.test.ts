import { describe, expect, it } from "vitest";
import { de, enUS } from "date-fns/locale";
import {
  addMonthsKey,
  addWeeksKey,
  isInMonth,
  monthGridWeeks,
  monthKeyOf,
  parseDateKey,
  resolveDateFnsLocale,
  splitWeekByMonth,
  toDateKey,
  weekDates,
  weekKeyFor,
  weekNumber,
  weekStraddlesYear,
} from "./dates";

// Fixed day-of-week facts used below: 2026-01-01 is a Thursday, so
// 2026-02-01 is a Sunday, 2026-08-17 a Monday, 2026-08-30 and 2026-12-27 Sundays.

describe("date keys", () => {
  it("round-trips through local midnight", () => {
    const d = parseDateKey("2026-08-17");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(0);
    expect(toDateKey(d)).toBe("2026-08-17");
  });

  it("month helpers", () => {
    expect(monthKeyOf("2026-08-17")).toBe("2026-08");
    expect(isInMonth("2026-08-17", "2026-08")).toBe(true);
    expect(isInMonth("2026-09-01", "2026-08")).toBe(false);
    expect(addMonthsKey("2026-12", 1)).toBe("2027-01");
    expect(addMonthsKey("2026-01", -1)).toBe("2025-12");
  });
});

describe("locale-driven weeks", () => {
  it("week key is the locale week's start date", () => {
    // Monday 2026-08-17: US weeks start Sunday, German weeks start Monday
    expect(weekKeyFor("2026-08-17", enUS)).toBe("2026-08-16");
    expect(weekKeyFor("2026-08-17", de)).toBe("2026-08-17");
    // Sunday 2026-08-16 belongs to different weeks per locale
    expect(weekKeyFor("2026-08-16", enUS)).toBe("2026-08-16");
    expect(weekKeyFor("2026-08-16", de)).toBe("2026-08-10");
  });

  it("week numbers are locale-driven, not ISO", () => {
    expect(weekNumber("2026-01-01", enUS)).toBe(1);
    // same displayed week ⇒ same number (enUS: Sun 16th through Sat 22nd)
    expect(weekNumber("2026-08-16", enUS)).toBe(weekNumber("2026-08-22", enUS));
    // under de the Sunday belongs to the previous week
    expect(weekNumber("2026-08-16", de)).not.toBe(weekNumber("2026-08-17", de));
  });

  it("weekDates and addWeeksKey", () => {
    const days = weekDates("2026-08-16");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-16");
    expect(days[6]).toBe("2026-08-22");
    expect(addWeeksKey("2026-08-16", 1)).toBe("2026-08-23");
    expect(addWeeksKey("2026-08-16", -1)).toBe("2026-08-09");
  });

  it("maps BCP-47 tags to date-fns locales with fallbacks", () => {
    expect(resolveDateFnsLocale("en-US").code).toBe("en-US");
    expect(resolveDateFnsLocale("de-DE").code).toBe("de");
    expect(resolveDateFnsLocale("xx-XX").code).toBe("en-US");
  });
});

describe("month grid", () => {
  it("Feb 2026 under enUS is exactly 4 full in-month rows", () => {
    const weeks = monthGridWeeks(2026, 2, enUS);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe("2026-02-01");
    expect(weeks[3][6]).toBe("2026-02-28");
  });

  it("Aug 2026 under enUS spans 6 rows with out-of-month edges", () => {
    const weeks = monthGridWeeks(2026, 8, enUS);
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toBe("2026-07-26");
    expect(weeks[5][6]).toBe("2026-09-05");
  });
});

describe("straddling weeks", () => {
  it("splits by month chronologically", () => {
    const segs = splitWeekByMonth("2026-08-30"); // Aug 30 – Sep 5
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ year: 2026, month: 8 });
    expect(segs[0].dateKeys).toEqual(["2026-08-30", "2026-08-31"]);
    expect(segs[1]).toMatchObject({ year: 2026, month: 9 });
    expect(segs[1].dateKeys).toHaveLength(5);
  });

  it("non-straddling week is a single segment", () => {
    expect(splitWeekByMonth("2026-08-16")).toHaveLength(1);
  });

  it("year-boundary week", () => {
    const segs = splitWeekByMonth("2026-12-27"); // Dec 27 – Jan 2
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ year: 2026, month: 12 });
    expect(segs[1]).toMatchObject({ year: 2027, month: 1 });
    expect(weekStraddlesYear("2026-12-27")).toBe(true);
    expect(weekStraddlesYear("2026-08-16")).toBe(false);
  });
});
