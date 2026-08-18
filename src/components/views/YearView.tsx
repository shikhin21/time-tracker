import { useMemo } from "react";
import { useEntriesRange } from "../../hooks/useEntriesRange";
import {
  getActiveLocale,
  isInMonth,
  monthGridWeeks,
  todayKey,
  weekNumber,
  yearOf,
} from "../../lib/dates";
import { formatDateKey, formatQuarters } from "../../lib/format";
import { sumForDays, sumForMonth } from "../../lib/totals";
import { useAppStore } from "../../store/appStore";

function YearMonthMini(props: {
  year: number;
  month: number; // 1-based
  dayTotals: Map<string, number>;
  today: string;
}) {
  const drillToMonth = useAppStore((s) => s.drillToMonth);
  const openDay = useAppStore((s) => s.openDay);
  const selectedDayKey = useAppStore((s) => s.selectedDayKey);
  const locale = getActiveLocale();
  const monthKey = `${props.year}-${String(props.month).padStart(2, "0")}`;
  const weeks = useMemo(
    () => monthGridWeeks(props.year, props.month, locale),
    [props.year, props.month, locale],
  );

  return (
    <section className="year-month">
      <button
        className="year-month-name"
        title="Open month"
        onClick={() => drillToMonth(monthKey)}
      >
        {formatDateKey(`${monthKey}-01`, "LLLL")}
      </button>

      <div className="year-month-grid">
        <div className="year-week-row year-header-row">
          <span className="year-week-num">Wk</span>
          {weeks[0].map((dateKey) => (
            <span key={dateKey} className="year-day-name">
              {formatDateKey(dateKey, "EEEEE")}
            </span>
          ))}
          <span className="year-week-total">Hrs</span>
        </div>
        {weeks.map((week) => {
          const inMonthKeys = week.filter((k) => isInMonth(k, monthKey));
          const quarters = sumForDays(props.dayTotals, inMonthKeys);
          return (
            <div key={week[0]} className="year-week-row">
              <span className="year-week-num">{weekNumber(week[0])}</span>
              {week.map((dateKey) => (
                <button
                  key={dateKey}
                  className={[
                    "year-day",
                    isInMonth(dateKey, monthKey) ? "" : "out",
                    dateKey === props.today ? "today" : "",
                    dateKey === selectedDayKey ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => openDay(dateKey)}
                >
                  {Number(dateKey.slice(8, 10))}
                </button>
              ))}
              <span className="year-week-total">
                {quarters === 0 && inMonthKeys.every((k) => !props.dayTotals.has(k))
                  ? ""
                  : formatQuarters(quarters)}
              </span>
            </div>
          );
        })}
        <div className="year-week-row year-month-total-row">
          <span className="year-week-num" />
          <span className="year-month-total-label">Total</span>
          <span className="year-week-total">
            {formatQuarters(sumForMonth(props.dayTotals, monthKey))}
          </span>
        </div>
      </div>
    </section>
  );
}

export function YearView() {
  const anchorKey = useAppStore((s) => s.anchorKey);
  const projectId = useAppStore((s) => s.currentProjectId);
  const year = yearOf(anchorKey);
  const { dayTotals } = useEntriesRange(projectId, `${year}-01-01`, `${year}-12-31`);
  const today = todayKey();

  return (
    <div className="year-grid">
      {Array.from({ length: 12 }, (_, i) => (
        <YearMonthMini
          key={i + 1}
          year={year}
          month={i + 1}
          dayTotals={dayTotals}
          today={today}
        />
      ))}
    </div>
  );
}
