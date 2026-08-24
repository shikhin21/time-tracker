import { describe, expect, it } from "vitest";
import { canExport, exportBlockers, type BlockerInput } from "./exportBlockers";

/** A fully valid invoice: no blockers. Each test spoils one thing. */
const clean: BlockerInput = {
  loaded: true,
  number: "037",
  today: "2026-09-02",
  periodEnd: "2026-08-31",
  lineCount: 1,
  amountDue: 1207.5,
  unratedDates: [],
  unratedHours: 0,
  fromName: "FNU Shikhin",
  clientName: "Centre for Applied Ethics Ltd",
  existing: [],
};

const ids = (input: Partial<BlockerInput>) =>
  exportBlockers({ ...clean, ...input }).map((b) => b.id);

describe("exportBlockers", () => {
  it("finds nothing wrong with a complete invoice", () => {
    expect(exportBlockers(clean)).toEqual([]);
    expect(canExport([], new Set())).toBe(true);
  });

  it("reports only that it's loading before the data arrives", () => {
    expect(ids({ loaded: false, number: "" })).toEqual(["loading"]);
  });

  it("requires an invoice number, and won't let it be waived", () => {
    const [blocker] = exportBlockers({ ...clean, number: "  " });
    expect(blocker.id).toBe("number");
    expect(blocker.action).toBeUndefined();
    expect(canExport([blocker], new Set(["number"]))).toBe(false);
  });

  describe("unfinished period", () => {
    it("warns while the period end is still in the future", () => {
      expect(ids({ today: "2026-08-24" })).toContain("period-open");
    });

    it("stays quiet on the period's last day", () => {
      expect(ids({ today: "2026-08-31" })).not.toContain("period-open");
    });

    it("stays quiet once the period has passed", () => {
      expect(ids({ today: "2026-09-01" })).not.toContain("period-open");
    });
  });

  it("flags a period that was already invoiced, naming the prior invoice", () => {
    const [blocker] = exportBlockers({
      ...clean,
      existing: [
        {
          number: "036",
          invoiceDate: "2026-08-07",
          periodStart: "2026-08-01",
          periodEnd: "2026-08-31",
        },
      ],
    });
    expect(blocker.id).toBe("already-invoiced");
    expect(blocker.message).toContain("#036");
    expect(blocker.message).toContain("08-01-2026 to 08-31-2026");
    expect(blocker.action).toBeDefined();
  });

  it("flags an invoice with nothing billable on it", () => {
    const [blocker] = exportBlockers({ ...clean, lineCount: 0, amountDue: 0 });
    expect(blocker.id).toBe("nothing-billable");
    expect(blocker.message).toContain("$0.00");
  });

  it("names whichever billing block would print blank", () => {
    expect(exportBlockers({ ...clean, fromName: "" })[0].message).toContain("your details");
    expect(exportBlockers({ ...clean, clientName: "" })[0].message).toContain("the client");
    expect(exportBlockers({ ...clean, fromName: " ", clientName: "" })[0].message).toContain(
      "your details and the client",
    );
  });

  it("reports unbillable days with their hours and dates", () => {
    const [blocker] = exportBlockers({
      ...clean,
      unratedDates: ["2026-08-03", "2026-08-04"],
      unratedHours: 12.5,
    });
    expect(blocker.id).toBe("unrated-days");
    expect(blocker.message).toContain("12.5 hours on 2 days");
    expect(blocker.detail).toBe("08-03-2026, 08-04-2026");
  });

  it("says 'day' for a single unbillable day", () => {
    const [blocker] = exportBlockers({
      ...clean,
      unratedDates: ["2026-08-03"],
      unratedHours: 6,
    });
    expect(blocker.message).toContain("6 hours on 1 day");
  });

  it("lists what must be fixed before what can be waived", () => {
    expect(ids({ number: "", today: "2026-08-01", lineCount: 0, clientName: "" })).toEqual([
      "number",
      "period-open",
      "nothing-billable",
      "missing-parties",
    ]);
  });
});

describe("canExport", () => {
  const waivable = exportBlockers({ ...clean, today: "2026-08-01" });

  it("stays blocked until every waivable reason is ticked", () => {
    expect(canExport(waivable, new Set())).toBe(false);
    expect(canExport(waivable, new Set(["period-open"]))).toBe(true);
  });

  it("stays blocked when only some reasons are ticked", () => {
    const several = exportBlockers({ ...clean, today: "2026-08-01", clientName: "" });
    expect(canExport(several, new Set(["period-open"]))).toBe(false);
    expect(canExport(several, new Set(["period-open", "missing-parties"]))).toBe(true);
  });

  it("can't be unblocked by ticking something that must be fixed", () => {
    const withHard = exportBlockers({ ...clean, number: "", today: "2026-08-01" });
    expect(canExport(withHard, new Set(["number", "period-open"]))).toBe(false);
  });
});
