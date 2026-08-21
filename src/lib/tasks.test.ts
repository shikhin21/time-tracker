import { describe, expect, it } from "vitest";
import { tasksForDays, tasksForWeek, type TaskEntryLike } from "./tasks";

// Sun 2026-08-09 … Sat 2026-08-15, plus neighbours either side.
const entries: TaskEntryLike[] = [
  { date: "2026-08-08", hours: 1, task: "prior week" },
  { date: "2026-08-10", hours: 2, task: "api migration" },
  { date: "2026-08-11", hours: 3.25, task: "design review" },
  { date: "2026-08-12", hours: 1.5, task: "api migration" },
  { date: "2026-08-13", hours: 0.5, task: "standup" },
  { date: "2026-08-13", hours: 2, task: "api migration" },
  { date: "2026-08-16", hours: 4, task: "next week" },
];

describe("tasksForWeek", () => {
  it("collapses a repeated label into one row carrying the week's total", () => {
    const tasks = tasksForWeek(entries, "2026-08-09");
    expect(tasks).toEqual([
      { task: "api migration", quarters: 22 }, // 2 + 1.5 + 2 hours
      { task: "design review", quarters: 13 },
      { task: "standup", quarters: 2 },
    ]);
  });

  it("only counts the seven days of that week", () => {
    const labels = tasksForWeek(entries, "2026-08-09").map((t) => t.task);
    expect(labels).not.toContain("prior week");
    expect(labels).not.toContain("next week");
  });

  it("spans the whole Sun–Sat week, not just the days inside one month", () => {
    // Sun 2026-08-30 … Sat 2026-09-05 straddles the month boundary.
    const straddling: TaskEntryLike[] = [
      { date: "2026-08-31", hours: 1, task: "august side" },
      { date: "2026-09-01", hours: 1, task: "september side" },
    ];
    const labels = tasksForWeek(straddling, "2026-08-30").map((t) => t.task);
    expect(labels).toEqual(["august side", "september side"]);
  });
});

describe("tasksForDays", () => {
  it("drops entries with no usable label but keeps their day's other tasks", () => {
    const tasks = tasksForDays(
      [
        { date: "2026-08-10", hours: 5, task: null },
        { date: "2026-08-10", hours: 1, task: "   " },
        { date: "2026-08-10", hours: 2, task: "  real task  " },
      ],
      ["2026-08-10"],
    );
    expect(tasks).toEqual([{ task: "real task", quarters: 8 }]);
  });

  it("orders by hours desc, breaking ties by first appearance then label", () => {
    const tasks = tasksForDays(
      [
        { date: "2026-08-11", hours: 1, task: "later, same hours" },
        { date: "2026-08-10", hours: 1, task: "earlier, same hours" },
        { date: "2026-08-12", hours: 9, task: "biggest" },
      ],
      ["2026-08-10", "2026-08-11", "2026-08-12"],
    );
    expect(tasks.map((t) => t.task)).toEqual([
      "biggest",
      "earlier, same hours",
      "later, same hours",
    ]);
  });

  it("keeps labels differing only in case separate", () => {
    const tasks = tasksForDays(
      [
        { date: "2026-08-10", hours: 1, task: "Standup" },
        { date: "2026-08-10", hours: 1, task: "standup" },
      ],
      ["2026-08-10"],
    );
    expect(tasks).toHaveLength(2);
  });

  it("returns nothing for a week with no logged tasks", () => {
    expect(tasksForDays(entries, ["2026-08-23"])).toEqual([]);
  });
});
