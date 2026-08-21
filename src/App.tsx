import { useEffect } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { OnboardingCreateProject } from "./components/project/OnboardingCreateProject";
import { useAppStore } from "./store/appStore";
import { useSystemTheme } from "./theme/useSystemTheme";

export default function App() {
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const init = useAppStore((s) => s.init);

  useSystemTheme();

  useEffect(() => {
    void init();
  }, [init]);

  switch (status) {
    case "loading":
      return <div className="app-centered">Loading…</div>;
    case "error":
      return (
        <div className="app-centered">
          <strong>Couldn't open the database.</strong>
          <span>{error}</span>
        </div>
      );
    case "onboarding":
      return <OnboardingCreateProject />;
    case "ready":
      return <MainLayout />;
  }
}
