import { useState } from "react";
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
import { ProjectCreateModal } from "../project/ProjectCreateModal";
import { ThemeToggle } from "./ThemeToggle";

const NEW_PROJECT = "__new__";

function ProjectSwitcher() {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const selectProject = useAppStore((s) => s.selectProject);
  const [creating, setCreating] = useState(false);

  return (
    <div className="project-switcher">
      <select
        aria-label="Project"
        value={currentProjectId ?? ""}
        onChange={(e) => {
          if (e.target.value === NEW_PROJECT) {
            setCreating(true);
          } else {
            void selectProject(e.target.value);
          }
        }}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value={NEW_PROJECT}>+ New project…</option>
      </select>
      {creating && <ProjectCreateModal onClose={() => setCreating(false)} />}
    </div>
  );
}

/** The invoices view has no period, so it can't be labelled — the type says so
 *  rather than the switch carrying a case that never runs. */
function periodLabel(view: Exclude<ViewKind, "invoices">, anchorKey: string): string {
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

function Breadcrumb() {
  const view = useAppStore((s) => s.view);
  const anchorKey = useAppStore((s) => s.anchorKey);
  const setView = useAppStore((s) => s.setView);
  const drillToWeek = useAppStore((s) => s.drillToWeek);

  const crumb = (target: ViewKind, label: string) => (
    <button
      className={`nav-btn${view === target ? " active" : ""}`}
      onClick={() => {
        if (target === "week") drillToWeek(weekKeyFor(anchorKey));
        else setView(target);
      }}
    >
      {label}
    </button>
  );

  return (
    <nav className="breadcrumb" aria-label="View">
      {crumb("year", "Year")}
      <span>▸</span>
      {crumb("month", "Month")}
      <span>▸</span>
      {crumb("week", "Week")}
    </nav>
  );
}

function PeriodNav() {
  const view = useAppStore((s) => s.view);
  const anchorKey = useAppStore((s) => s.anchorKey);
  const selectedDayKey = useAppStore((s) => s.selectedDayKey);
  const goPrev = useAppStore((s) => s.goPrev);
  const goNext = useAppStore((s) => s.goNext);
  const goToday = useAppStore((s) => s.goToday);
  const isTodaySelected = selectedDayKey === todayKey();

  if (view === "invoices") return null;

  return (
    <div className="period-nav">
      <button
        className={isTodaySelected ? "nav-btn active" : "btn btn-ghost"}
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

export function Header() {
  const openSettings = useAppStore((s) => s.openSettings);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const onInvoices = view === "invoices";
  return (
    <header className="header">
      <button
        className="icon-btn settings-btn"
        aria-label="Settings"
        title="Settings"
        onClick={openSettings}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.32.64.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.24.1.5.02.64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
        </svg>
      </button>
      <ProjectSwitcher />
      <div className="header-divider header-divider--left" />
      <Breadcrumb />
      {!onInvoices && (
        <>
          <div className="header-divider header-divider--right" />
          <PeriodNav />
        </>
      )}
      <div className="header-divider header-divider--left" />
      <button
        className={onInvoices ? "nav-btn active" : "btn btn-ghost"}
        onClick={() => setView("invoices")}
      >
        Invoices
      </button>
      <div className="spacer" />
      <ThemeToggle />
    </header>
  );
}
