import { describe, expect, it } from "vitest";
import {
  canExport,
  exportBlockers,
  monthsSpanned,
  type BlockerInput,
} from "./exportBlockers";

/** A fully valid invoice: no blockers. Each test spoils one thing. */
const clean: BlockerInput = {
  loaded: true,
  number: "037",
  today: "2026-09-02",
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31",
  lineCount: 1,
  amountDue: 1207.5,
  unratedDates: [],
  unratedHours: 0,
  fromName: "FNU Shikhin",
  clientName: "Centre for Applied Ethics Ltd",
  priorInvoices: [],
  usedNumbers: [],
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

  describe("a number already used", () => {
    it("must be changed, not waived — the db enforces it too", () => {
      const [blocker] = exportBlockers({ ...clean, number: "037", usedNumbers: ["036", "037"] });
      expect(blocker.id).toBe("number-taken");
      expect(blocker.message).toContain("#037");
      expect(blocker.action).toBeUndefined();
      expect(canExport([blocker], new Set(["number-taken"]))).toBe(false);
    });

    it("compares trimmed, so stray spaces don't sneak a duplicate through", () => {
      expect(ids({ number: " 037 ", usedNumbers: ["037"] })).toContain("number-taken");
    });

    it("stays quiet for a number this project hasn't used", () => {
      expect(ids({ number: "038", usedNumbers: ["036", "037"] })).toEqual([]);
    });

    it("doesn't also demand a number when the field is empty", () => {
      expect(ids({ number: "", usedNumbers: ["036"] })).toEqual(["number"]);
    });
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

  describe("period spanning months", () => {
    it("stays quiet for a period inside one month", () => {
      expect(ids({ periodStart: "2026-08-05", periodEnd: "2026-08-20" })).not.toContain(
        "period-multi-month",
      );
    });

    it("warns, waivably, when the period crosses a month boundary", () => {
      const [blocker] = exportBlockers({
        ...clean,
        periodStart: "2026-07-15",
        periodEnd: "2026-08-14",
      });
      expect(blocker.id).toBe("period-multi-month");
      expect(blocker.message).toContain("covers 2 months");
      expect(blocker.message).toContain("07-15-2026 to 08-14-2026");
      expect(blocker.action).toBeDefined();
    });

    it("counts every month touched, not just the endpoints", () => {
      const [blocker] = exportBlockers({
        ...clean,
        periodStart: "2026-07-31",
        periodEnd: "2026-09-01",
      });
      expect(blocker.message).toContain("covers 3 months");
    });

    it("counts across a year boundary", () => {
      expect(monthsSpanned("2026-12-01", "2027-01-31")).toBe(2);
      expect(monthsSpanned("2026-11-01", "2027-02-28")).toBe(4);
    });

    it("treats a single day as one month", () => {
      expect(monthsSpanned("2026-08-14", "2026-08-14")).toBe(1);
    });
  });

  describe("reversed period", () => {
    it("must be fixed, not waived — reversed dates cover nothing", () => {
      const [blocker] = exportBlockers({
        ...clean,
        periodStart: "2026-08-31",
        periodEnd: "2026-08-01",
      });
      expect(blocker.id).toBe("period-reversed");
      expect(blocker.action).toBeUndefined();
      expect(canExport([blocker], new Set(["period-reversed"]))).toBe(false);
    });

    it("doesn't also claim the period spans months", () => {
      expect(ids({ periodStart: "2026-09-30", periodEnd: "2026-08-01" })).not.toContain(
        "period-multi-month",
      );
    });
  });

  it("flags a period that was already invoiced, naming the prior invoice", () => {
    const [blocker] = exportBlockers({
      ...clean,
      priorInvoices: [
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

  describe("overlapping a prior invoice", () => {
    const july: BlockerInput["priorInvoices"][number] = {
      number: "036",
      invoiceDate: "2026-08-02",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    };

    it("flags a period that runs into an earlier invoice's days", () => {
      const [blocker] = exportBlockers({
        ...clean,
        periodStart: "2026-07-15",
        periodEnd: "2026-07-20",
        priorInvoices: [july],
      });
      expect(blocker.id).toBe("period-overlaps");
      expect(blocker.message).toContain("#036");
      expect(blocker.message).toContain("07-01-2026 to 07-31-2026");
      expect(blocker.action).toBeDefined();
    });

    it("catches an overlap of a single day at either edge", () => {
      const startsOnLastDay = ids({
        periodStart: "2026-07-31",
        periodEnd: "2026-08-31",
        priorInvoices: [july],
      });
      const endsOnFirstDay = ids({
        periodStart: "2026-06-01",
        periodEnd: "2026-07-01",
        priorInvoices: [july],
      });
      expect(startsOnLastDay).toContain("period-overlaps");
      expect(endsOnFirstDay).toContain("period-overlaps");
    });

    it("stays quiet for a period that merely abuts one", () => {
      expect(ids({ priorInvoices: [july] })).not.toContain("period-overlaps"); // Aug 1–31
      expect(
        ids({ periodStart: "2026-06-01", periodEnd: "2026-06-30", priorInvoices: [july] }),
      ).not.toContain("period-overlaps");
    });

    it("re-checks rather than trusting the caller's filtering", () => {
      // a non-overlapping row reaching this function must not be reported
      expect(ids({ priorInvoices: [{ ...july, periodStart: "2020-01-01", periodEnd: "2020-01-31" }] }))
        .toEqual([]);
    });

    it("reports an exact re-issue as such, not as an overlap", () => {
      const reissue = ids({
        priorInvoices: [{ ...july, periodStart: "2026-08-01", periodEnd: "2026-08-31" }],
      });
      expect(reissue).toEqual(["already-invoiced"]);
    });

    it("counts the other overlapping invoices when there are several", () => {
      const withTwo = (extra: number) =>
        exportBlockers({
          ...clean,
          periodStart: "2026-07-15",
          periodEnd: "2026-08-15",
          priorInvoices: [
            july,
            ...Array.from({ length: extra }, (_, i) => ({
              ...july,
              number: `03${i}`,
              periodStart: "2026-08-01",
              periodEnd: "2026-08-10",
            })),
          ],
        }).find((b) => b.id === "period-overlaps");

      expect(withTwo(0)?.message).toContain("which overlaps this period.");
      expect(withTwo(1)?.message).toContain("as does 1 other invoice");
      expect(withTwo(2)?.message).toContain("as do 2 other invoices");
    });
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
