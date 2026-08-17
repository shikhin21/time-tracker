import { describe, expect, it } from "vitest";
import {
  checkRateDateConflict,
  computeRateImpact,
  diffRateTimelines,
  applyRateChange,
  resolveRate,
  sortRates,
  type CountEntriesFn,
  type RateLike,
} from "./rates";

const rates: RateLike[] = [
  { id: "a", effectiveDate: "2026-01-01", rate: 50 },
  { id: "b", effectiveDate: "2026-06-01", rate: 75 },
];

const makeCounter = (entryDates: string[]): CountEntriesFn =>
  async (from, to) => {
    const hits = entryDates.filter((d) => d >= from && (to === null || d <= to)).sort();
    return {
      count: hits.length,
      minDate: hits[0] ?? null,
      maxDate: hits[hits.length - 1] ?? null,
    };
  };

describe("resolveRate", () => {
  it("resolves the latest effectiveDate ≤ day", () => {
    expect(resolveRate(rates, "2025-12-31")).toBeUndefined(); // before first → no rate
    expect(resolveRate(rates, "2026-01-01")?.id).toBe("a"); // on the boundary
    expect(resolveRate(rates, "2026-05-31")?.id).toBe("a");
    expect(resolveRate(rates, "2026-06-01")?.id).toBe("b");
    expect(resolveRate(rates, "2027-01-01")?.id).toBe("b"); // carries forward
  });

  it("sortRates orders by effectiveDate without mutating", () => {
    const shuffled = [rates[1], rates[0]];
    expect(sortRates(shuffled).map((r) => r.id)).toEqual(["a", "b"]);
    expect(shuffled[0].id).toBe("b");
  });
});

describe("date conflicts", () => {
  it("rejects add on an occupied date", () => {
    expect(
      checkRateDateConflict(rates, { type: "add", effectiveDate: "2026-06-01", rate: 80 }),
    ).toMatch(/already exists/);
  });

  it("rejects moving a row onto another row's date, but allows keeping its own", () => {
    expect(
      checkRateDateConflict(rates, {
        type: "edit",
        rateId: "a",
        newEffectiveDate: "2026-06-01",
      }),
    ).toMatch(/already exists/);
    expect(
      checkRateDateConflict(rates, {
        type: "edit",
        rateId: "b",
        newEffectiveDate: "2026-06-01",
      }),
    ).toBeNull();
  });

  it("allows non-conflicting changes", () => {
    expect(
      checkRateDateConflict(rates, { type: "add", effectiveDate: "2026-03-01", rate: 60 }),
    ).toBeNull();
    expect(checkRateDateConflict(rates, { type: "delete", rateId: "a" })).toBeNull();
  });
});

describe("computeRateImpact", () => {
  const count = makeCounter(["2026-02-10", "2026-04-05", "2026-06-15", "2026-07-01"]);

  it("add in the past: span until the next rate, old resolved rate → new", async () => {
    const impact = await computeRateImpact(
      rates,
      { type: "add", effectiveDate: "2026-03-01", rate: 60 },
      count,
    );
    expect(impact.segments).toEqual([
      { fromDate: "2026-03-01", toDate: "2026-05-31", oldRate: 50, newRate: 60 },
    ]);
    expect(impact.affectedEntryCount).toBe(1); // only 2026-04-05
    expect(impact.affectedFrom).toBe("2026-04-05");
    expect(impact.becomesNoRate).toBe(false);
  });

  it("add before the first rate: old rate is none", async () => {
    const impact = await computeRateImpact(
      rates,
      { type: "add", effectiveDate: "2025-12-01", rate: 40 },
      count,
    );
    expect(impact.segments).toEqual([
      { fromDate: "2025-12-01", toDate: "2025-12-31", oldRate: null, newRate: 40 },
    ]);
  });

  it("edit (value): open-ended span for the last rate", async () => {
    const impact = await computeRateImpact(
      rates,
      { type: "edit", rateId: "b", newRate: 80 },
      count,
    );
    expect(impact.segments).toEqual([
      { fromDate: "2026-06-01", toDate: null, oldRate: 75, newRate: 80 },
    ]);
    expect(impact.affectedEntryCount).toBe(2); // Jun 15 + Jul 1
  });

  it("edit (date): the vacated span falls back to the previous rate", async () => {
    const impact = await computeRateImpact(
      rates,
      { type: "edit", rateId: "b", newEffectiveDate: "2026-07-01" },
      count,
    );
    expect(impact.segments).toEqual([
      { fromDate: "2026-06-01", toDate: "2026-06-30", oldRate: 75, newRate: 50 },
    ]);
  });

  it("delete a later rate: span shifts onto the previous rate", async () => {
    const impact = await computeRateImpact(rates, { type: "delete", rateId: "b" }, count);
    expect(impact.segments).toEqual([
      { fromDate: "2026-06-01", toDate: null, oldRate: 75, newRate: 50 },
    ]);
    expect(impact.becomesNoRate).toBe(false);
  });

  it("delete the first rate: explicit no-rate flag", async () => {
    const impact = await computeRateImpact(rates, { type: "delete", rateId: "a" }, count);
    expect(impact.segments).toEqual([
      { fromDate: "2026-01-01", toDate: "2026-05-31", oldRate: 50, newRate: null },
    ]);
    expect(impact.becomesNoRate).toBe(true);
    expect(impact.affectedEntryCount).toBe(2); // Feb 10 + Apr 5
  });

  it("a no-op change produces no segments", async () => {
    const same: RateLike[] = [
      { id: "a", effectiveDate: "2026-01-01", rate: 50 },
      { id: "b", effectiveDate: "2026-03-01", rate: 50 },
    ];
    const impact = await computeRateImpact(same, { type: "delete", rateId: "b" }, count);
    expect(impact.segments).toEqual([]);
    expect(impact.affectedEntryCount).toBe(0);
  });
});

describe("diffRateTimelines with supersession", () => {
  it("a row moved behind another row is superseded by it", () => {
    const old: RateLike[] = [
      { id: "a", effectiveDate: "2026-01-01", rate: 50 },
      { id: "b", effectiveDate: "2026-03-01", rate: 50 },
      { id: "c", effectiveDate: "2026-05-01", rate: 80 },
    ];
    // moving c back to Feb 1 puts it before b, so b (50) supersedes it from
    // Mar 1 — c's 80 now only covers Feb, and the old May-onward 80 reverts
    const changed = applyRateChange(old, {
      type: "edit",
      rateId: "c",
      newEffectiveDate: "2026-02-01",
    });
    expect(diffRateTimelines(old, changed)).toEqual([
      { fromDate: "2026-02-01", toDate: "2026-02-28", oldRate: 50, newRate: 80 },
      { fromDate: "2026-05-01", toDate: null, oldRate: 80, newRate: 50 },
    ]);
  });
});
