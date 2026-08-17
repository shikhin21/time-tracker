import { DayDetailPanel } from "../day/DayDetailPanel";
import { MonthView } from "../views/MonthView";
import { useAppStore } from "../../store/appStore";
import { Header } from "./Header";

function ViewPlaceholder({ label }: { label: string }) {
  return <div className="app-centered">{label} view</div>;
}

export function MainLayout() {
  const view = useAppStore((s) => s.view);
  const selectedDayKey = useAppStore((s) => s.selectedDayKey);

  return (
    <div className="app">
      <Header />
      <div className="content-row">
        <main className="view-scroll">
          {view === "year" && <ViewPlaceholder label="Year" />}
          {view === "month" && <MonthView />}
          {view === "week" && <ViewPlaceholder label="Week" />}
        </main>
        {selectedDayKey && <DayDetailPanel key={selectedDayKey} dayKey={selectedDayKey} />}
      </div>
    </div>
  );
}
