import { weekDates } from "./dates";
import { toQuarters } from "./validation";

export interface TaskEntryLike {
  date: string; // "YYYY-MM-DD"
  hours: number;
  task: string | null;
}

export interface TaskTotal {
  task: string;
  /** Summed across every entry with this label in the period. */
  quarters: number;
}

interface Accumulated extends TaskTotal {
  firstDate: string;
}

/** Distinct task labels worked across `dateKeys`, each with its summed total.
 *  A label logged on several days collapses into one row.
 *
 *  Untitled entries (null/blank task) are left out — they carry hours but no
 *  label to list. Labels are matched exactly, so "Standup" and "standup" stay
 *  separate, the same way the task suggestion pool treats them.
 *
 *  Ordered by hours descending, then by first appearance, then by label, so
 *  the biggest tasks lead and a truncated list keeps the ones that matter. */
export function tasksForDays(entries: TaskEntryLike[], dateKeys: string[]): TaskTotal[] {
  const wanted = new Set(dateKeys);
  const byTask = new Map<string, Accumulated>();

  for (const entry of entries) {
    const task = entry.task?.trim();
    if (!task || !wanted.has(entry.date)) continue;
    const found = byTask.get(task);
    if (found) {
      found.quarters += toQuarters(entry.hours);
      if (entry.date < found.firstDate) found.firstDate = entry.date;
    } else {
      byTask.set(task, {
        task,
        quarters: toQuarters(entry.hours),
        firstDate: entry.date,
      });
    }
  }

  return [...byTask.values()]
    .sort(
      (a, b) =>
        b.quarters - a.quarters ||
        a.firstDate.localeCompare(b.firstDate) ||
        a.task.localeCompare(b.task),
    )
    .map(({ task, quarters }) => ({ task, quarters }));
}

/** The whole Sun–Sat week, including days outside the month being viewed —
 *  "what was worked on this week" rather than the month's slice of it. */
export function tasksForWeek(entries: TaskEntryLike[], weekKey: string): TaskTotal[] {
  return tasksForDays(entries, weekDates(weekKey));
}
