import { useAppStore } from "../../store/appStore";
import { Header } from "./Header";

function ViewPlaceholder({ label }: { label: string }) {
  return <div className="app-centered">{label} view</div>;
}

export function MainLayout() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="app">
      <Header />
      <main className="view-scroll">
        {view === "year" && <ViewPlaceholder label="Year" />}
        {view === "month" && <ViewPlaceholder label="Month" />}
        {view === "week" && <ViewPlaceholder label="Week" />}
      </main>
    </div>
  );
}
