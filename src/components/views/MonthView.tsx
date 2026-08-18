import { useMemo } from "react";
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
import { sumForDays, sumForMonth } from "../../lib/totals";
import { useAppStore } from "../../store/appStore";

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
      onClick={() => openDay(props.dateKey)}
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

  const monthKey = monthKeyOf(anchorKey);
  const year = yearOf(anchorKey);
  const month = Number(monthKey.slice(5, 7));
  const weeks = useMemo(() => monthGridWeeks(year, month), [year, month]);

  // Fetch the full visible grid so dimmed out-of-month cells still show totals
  const from = weeks[0][0];
  const to = weeks[weeks.length - 1][6];
  const { dayTotals } = useEntriesRange(projectId, from, to);
  const today = todayKey();

  return (
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
          </div>
        );
      })}

      <div className="month-row month-total-row">
        <span className="week-num-cell" />
        <span className="month-total-label">Month total</span>
        <span className="week-total-cell">
          {formatQuarters(sumForMonth(dayTotals, monthKey))}
        </span>
      </div>
    </div>
  );
}
