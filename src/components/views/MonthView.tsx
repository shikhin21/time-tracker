import { useMemo, useState } from "react";
import { useEntriesRange } from "../../hooks/useEntriesRange";
import {
  isInMonth,
  isWeekend,
  monthGridWeeks,
  monthKeyOf,
  todayKey,
  weekNumber,
  yearOf,
} from "../../lib/dates";
import { formatDateKey, formatQuarters } from "../../lib/format";
import { tasksForWeek, type TaskTotal } from "../../lib/tasks";
import { sumForDays, sumForMonth } from "../../lib/totals";
import { useAppStore } from "../../store/appStore";
import { PeriodNav } from "./PeriodNav";
import { InvoiceGenerator } from "../../invoice/InvoiceGenerator";

/** How many task rows fit in a week row before the rest collapse into
 *  "+N more". Kept in step with .week-tasks-cell's line-height in global.css:
 *  this many lines plus the "+N more" line must fit the row's 64px. */
const MAX_VISIBLE_TASKS = 3;

function taskLabel(t: TaskTotal): string {
  return `${t.task} — ${formatQuarters(t.quarters)}`;
}

function WeekTasksCell({ tasks }: { tasks: TaskTotal[] }) {
  const overflowing = tasks.length > MAX_VISIBLE_TASKS;
  // with an overflow line to place, one fewer task fits above it
  const shown = overflowing ? tasks.slice(0, MAX_VISIBLE_TASKS - 1) : tasks;
  const hidden = tasks.slice(shown.length);

  return (
    <div className="week-tasks-cell">
      {shown.map((t) => (
        <span key={t.task} className="week-task" title={taskLabel(t)}>
          <span className="week-task-name">{t.task}</span>
          <span className="week-task-hours">{formatQuarters(t.quarters)}</span>
        </span>
      ))}
      {hidden.length > 0 && (
        <span className="week-task more" title={hidden.map(taskLabel).join("\n")}>
          +{hidden.length} more
        </span>
      )}
    </div>
  );
}

function DayCell(props: {
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  quarters: number | undefined;
}) {
  const openDay = useAppStore((s) => s.openDay);
  const selectedDayKey = useAppStore((s) => s.selectedDayKey);
  return (
    <button
      className={[
        "day-cell",
        isWeekend(props.dateKey) ? "weekend" : "",
        props.inMonth ? "" : "out",
        props.isToday ? "today" : "",
        selectedDayKey === props.dateKey ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(e) => openDay(props.dateKey, e.currentTarget.getBoundingClientRect())}
      onDoubleClick={(e) =>
        openDay(props.dateKey, e.currentTarget.getBoundingClientRect(), true)
      }
    >
      <span className="day-num">{Number(props.dateKey.slice(8, 10))}</span>
      <span className="day-total">
        {props.quarters === undefined ? "" : formatQuarters(props.quarters)}
      </span>
    </button>
  );
}

export function MonthView() {
  const anchorKey = useAppStore((s) => s.anchorKey);
  const projectId = useAppStore((s) => s.currentProjectId);
  const drillToWeek = useAppStore((s) => s.drillToWeek);
  const [invoicing, setInvoicing] = useState(false);

  const monthKey = monthKeyOf(anchorKey);
  const year = yearOf(anchorKey);
  const month = Number(monthKey.slice(5, 7));
  const weeks = useMemo(() => monthGridWeeks(year, month), [year, month]);

  // Fetch the full visible grid so dimmed out-of-month cells still show totals
  const from = weeks[0][0];
  const to = weeks[weeks.length - 1][6];
  const { entries, dayTotals } = useEntriesRange(projectId, from, to);
  const today = todayKey();

  // the fetched range is exactly the visible grid, so every week's full
  // Sun–Sat span is already loaded — no extra query for out-of-month days
  const tasksByWeek = useMemo(
    () => new Map(weeks.map((week) => [week[0], tasksForWeek(entries, week[0])])),
    [entries, weeks],
  );

  return (
    <div className="period-view">
      <PeriodNav view="month" />
      <div className="month-grid" role="grid" aria-label={formatDateKey(`${monthKey}-01`, "LLLL yyyy")}>
      <div className="month-row month-header-row">
        <span className="week-num-cell" aria-label="Week number">
          Wk
        </span>
        {weeks[0].map((dateKey) => (
          <span key={dateKey} className="weekday-cell">
            {formatDateKey(dateKey, "EEE")}
          </span>
        ))}
        <span className="week-total-cell">Total</span>
        <span className="week-tasks-cell">Tasks</span>
      </div>

      {weeks.map((week) => {
        const weekKey = week[0];
        const inMonthKeys = week.filter((k) => isInMonth(k, monthKey));
        return (
          <div key={weekKey} className="month-row">
            <button
              className="week-num-cell clickable"
              title="Open week"
              onClick={() => drillToWeek(weekKey)}
            >
              {weekNumber(weekKey)}
            </button>
            {week.map((dateKey) => (
              <DayCell
                key={dateKey}
                dateKey={dateKey}
                inMonth={isInMonth(dateKey, monthKey)}
                isToday={dateKey === today}
                quarters={dayTotals.get(dateKey)}
              />
            ))}
            <span className="week-total-cell">
              {formatQuarters(sumForDays(dayTotals, inMonthKeys))}
            </span>
            <WeekTasksCell tasks={tasksByWeek.get(weekKey) ?? []} />
          </div>
        );
      })}

      <div className="month-row month-total-row">
        <span className="week-num-cell" />
        <span className="month-total-label">Month total</span>
        <span className="week-total-cell">
          {formatQuarters(sumForMonth(dayTotals, monthKey))}
        </span>
        <span className="month-invoice-cell">
          <button className="btn" onClick={() => setInvoicing(true)}>
            Generate invoice
          </button>
        </span>
      </div>

        {invoicing && (
          <InvoiceGenerator monthKey={monthKey} onClose={() => setInvoicing(false)} />
        )}
      </div>
    </div>
  );
}
