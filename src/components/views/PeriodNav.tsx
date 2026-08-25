import {
  monthKeyOf,
  todayKey,
  weekDates,
  weekKeyFor,
  weekStraddlesYear,
  yearOf,
} from "../../lib/dates";
import { formatDateKey } from "../../lib/format";
import { useAppStore, type ViewKind } from "../../store/appStore";

/** Only the period views have a period to label, which is why this lives with
 *  them rather than in the header. */
export type PeriodView = Exclude<ViewKind, "invoices">;

function periodLabel(view: PeriodView, anchorKey: string): string {
  switch (view) {
    case "year":
      return String(yearOf(anchorKey));
    case "month":
      return formatDateKey(`${monthKeyOf(anchorKey)}-01`, "LLLL yyyy");
    case "week": {
      const weekKey = weekKeyFor(anchorKey);
      const end = weekDates(weekKey)[6];
      const startPattern = weekStraddlesYear(weekKey) ? "MMM d, yyyy" : "MMM d";
      return `${formatDateKey(weekKey, startPattern)} – ${formatDateKey(end, "MMM d, yyyy")}`;
    }
  }
}

/** Moves the view through its own periods. Each period view renders one at the
 *  top of its own centred container, so it lines up with that view's grid —
 *  a single header-mounted nav couldn't align with grids of different widths.
 *  It sticks to the top so scrolling a long view doesn't take it away. */
export function PeriodNav({ view }: { view: PeriodView }) {
  const anchorKey = useAppStore((s) => s.anchorKey);
  const selectedDayKey = useAppStore((s) => s.selectedDayKey);
  const goPrev = useAppStore((s) => s.goPrev);
  const goNext = useAppStore((s) => s.goNext);
  const goToday = useAppStore((s) => s.goToday);
  const isTodaySelected = selectedDayKey === todayKey();

  return (
    <div className="period-nav">
      <button
        className={`btn btn-ghost${isTodaySelected ? " active" : ""}`}
        onClick={goToday}
      >
        Today
      </button>
      <button className="icon-btn" aria-label="Previous" onClick={goPrev}>
        ◀
      </button>
      <span className="period-label">{periodLabel(view, anchorKey)}</span>
      <button className="icon-btn" aria-label="Next" onClick={goNext}>
        ▶
      </button>
    </div>
  );
}
