import { DayDetailPanel } from "../day/DayDetailPanel";
import { QuickAddPopover } from "../day/QuickAddPopover";
import { SettingsPanel } from "../project/SettingsPanel";
import { MonthView } from "../views/MonthView";
import { WeekView } from "../views/WeekView";
import { YearView } from "../views/YearView";
import { useAppStore } from "../../store/appStore";
import { Header } from "./Header";

export function MainLayout() {
  const view = useAppStore((s) => s.view);
  const selectedDayKey = useAppStore((s) => s.selectedDayKey);
  const settingsOpen = useAppStore((s) => s.settingsOpen);

  return (
    <div className="app">
      <Header />
      <div className="content-row">
        <main className="view-scroll">
          {view === "year" && <YearView />}
          {view === "month" && <MonthView />}
          {view === "week" && <WeekView />}
        </main>
        {selectedDayKey && <DayDetailPanel key={selectedDayKey} dayKey={selectedDayKey} />}
      </div>
      <QuickAddPopover />
      {settingsOpen && <SettingsPanel />}
    </div>
  );
}
