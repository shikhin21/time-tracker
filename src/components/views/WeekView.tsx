import { useEntriesRange } from "../../hooks/useEntriesRange";
import type { EntryRow } from "../../db/db";
import { todayKey, weekDates, weekKeyFor } from "../../lib/dates";
import {
  formatDateKey,
  formatHoursLabel,
  formatQuarters,
  formatWeekSplitLabel,
} from "../../lib/format";
import { weekSplitTotals } from "../../lib/totals";
import { toQuarters } from "../../lib/validation";
import { useAppStore } from "../../store/appStore";

function WeekDayCard(props: {
  dateKey: string;
  entries: EntryRow[];
  quarters: number | undefined;
  isToday: boolean;
}) {
  const openDay = useAppStore((s) => s.openDay);
  const selectedDayKey = useAppStore((s) => s.selectedDayKey);
  return (
    <button
      className={[
        "weekday-card",
        props.isToday ? "today" : "",
        selectedDayKey === props.dateKey ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => openDay(props.dateKey)}
    >
      <div className="weekday-card-head">
        <span className="weekday-card-name">{formatDateKey(props.dateKey, "EEE")}</span>
        <span className="weekday-card-date">{formatDateKey(props.dateKey, "MMM d")}</span>
      </div>
      <div className="weekday-card-entries">
        {props.entries.map((e) => (
          <div key={e.id} className="weekday-card-entry">
            <span className="entry-hours">{formatQuarters(toQuarters(e.hours))}h</span>
            {e.task && <span className="entry-task">{e.task}</span>}
          </div>
        ))}
      </div>
      <div className="weekday-card-total">
        {props.quarters === undefined ? "" : formatHoursLabel(props.quarters)}
      </div>
    </button>
  );
}

export function WeekView() {
  const anchorKey = useAppStore((s) => s.anchorKey);
  const projectId = useAppStore((s) => s.currentProjectId);

  const weekKey = weekKeyFor(anchorKey);
  const days = weekDates(weekKey);
  const { entries, dayTotals } = useEntriesRange(projectId, days[0], days[6]);
  const splits = weekSplitTotals(dayTotals, weekKey);
  const today = todayKey();

  return (
    <div className="week-view">
      <div className="week-cards">
        {days.map((dateKey) => (
          <WeekDayCard
            key={dateKey}
            dateKey={dateKey}
            entries={entries.filter((e) => e.date === dateKey)}
            quarters={dayTotals.get(dateKey)}
            isToday={dateKey === today}
          />
        ))}
      </div>
      <div className="week-totals">
        {splits.length === 1 ? (
          <span>
            Week total: <strong>{formatHoursLabel(splits[0].quarters)}</strong>
          </span>
        ) : (
          <span className="week-totals-split">{formatWeekSplitLabel(splits)}</span>
        )}
      </div>
    </div>
  );
}
