import { useAppStore } from "../../store/appStore";
import { ProjectForm } from "./ProjectForm";

/** Blocking first-launch screen shown when no projects exist yet. */
export function OnboardingCreateProject() {
  const createProject = useAppStore((s) => s.createProject);
  return (
    <div className="onboarding">
      <div className="modal">
        <h1 className="onboarding-title">Welcome to Time Tracker</h1>
        <p className="onboarding-sub">Create your first project to get started.</p>
        <ProjectForm
          withRate
          submitLabel="Create project"
          onSubmit={async (values) => {
            await createProject({
              name: values.name,
              color: values.color,
              initialRate: values.initialRate,
            });
          }}
        />
      </div>
    </div>
  );
}
