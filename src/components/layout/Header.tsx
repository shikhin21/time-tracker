import { useState } from "react";
import {
  monthKeyOf,
  weekDates,
  weekKeyFor,
  weekNumber,
  weekStraddlesYear,
  yearOf,
} from "../../lib/dates";
import { formatDateKey } from "../../lib/format";
import { useAppStore, type ViewKind } from "../../store/appStore";
import { ProjectCreateModal } from "../project/ProjectCreateModal";

const NEW_PROJECT = "__new__";

function ProjectSwitcher() {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const selectProject = useAppStore((s) => s.selectProject);
  const [creating, setCreating] = useState(false);
  const current = projects.find((p) => p.id === currentProjectId);

  return (
    <div className="project-switcher">
      <span
        className="project-dot"
        style={{ background: `var(--project-${current?.color ?? "blue"})` }}
      />
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

function periodLabel(view: ViewKind, anchorKey: string): string {
  switch (view) {
    case "year":
      return String(yearOf(anchorKey));
    case "month":
      return formatDateKey(`${monthKeyOf(anchorKey)}-01`, "LLLL yyyy");
    case "week": {
      const weekKey = weekKeyFor(anchorKey);
      const end = weekDates(weekKey)[6];
      const startPattern = weekStraddlesYear(weekKey) ? "MMM d, yyyy" : "MMM d";
      return `Week ${weekNumber(weekKey)} · ${formatDateKey(weekKey, startPattern)} – ${formatDateKey(end, "MMM d, yyyy")}`;
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
      className={view === target ? "active" : ""}
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
  const goPrev = useAppStore((s) => s.goPrev);
  const goNext = useAppStore((s) => s.goNext);
  const goToday = useAppStore((s) => s.goToday);

  return (
    <div className="period-nav">
      <button className="btn btn-ghost" onClick={goToday}>
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
  return (
    <header className="header">
      <ProjectSwitcher />
      <Breadcrumb />
      <div className="spacer" />
      <PeriodNav />
      <div className="spacer" />
      <button className="btn btn-ghost" onClick={openSettings}>
        Settings
      </button>
    </header>
  );
}
