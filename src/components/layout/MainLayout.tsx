import { DayDetailPanel } from "../day/DayDetailPanel";
import { QuickAddPopover } from "../day/QuickAddPopover";
import { SettingsPanel } from "../project/SettingsPanel";
import { InvoiceDetailPanel } from "../../invoice/InvoiceDetailPanel";
import { InvoicesView } from "../views/InvoicesView";
import { MonthView } from "../views/MonthView";
import { WeekView } from "../views/WeekView";
import { YearView } from "../views/YearView";
import { useAppStore } from "../../store/appStore";
import { Header } from "./Header";

export function MainLayout() {
  const view = useAppStore((s) => s.view);
  const selectedDayKey = useAppStore((s) => s.selectedDayKey);
  const selectedInvoiceId = useAppStore((s) => s.selectedInvoiceId);
  const settingsOpen = useAppStore((s) => s.settingsOpen);

  return (
    <div className="app">
      <Header />
      <div className="content-row">
        <main className="view-scroll">
          {view === "year" && <YearView />}
          {view === "month" && <MonthView />}
          {view === "week" && <WeekView />}
          {view === "invoices" && <InvoicesView />}
        </main>
        {/* each drawer belongs to one kind of view, so which is shown follows
            from the view rather than from remembering to clear a selection */}
        {view !== "invoices" && selectedDayKey && (
          <DayDetailPanel key={selectedDayKey} dayKey={selectedDayKey} />
        )}
        {view === "invoices" && selectedInvoiceId && (
          <InvoiceDetailPanel invoiceId={selectedInvoiceId} />
        )}
      </div>
      <QuickAddPopover />
      {settingsOpen && <SettingsPanel />}
    </div>
  );
}
