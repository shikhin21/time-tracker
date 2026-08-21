import { useState } from "react";
import { userErrorMessage } from "../../lib/errors";
import { useAppStore } from "../../store/appStore";
import { Modal } from "../shared/Modal";
import { BillerSection } from "./BillerSection";
import { ClientSection } from "./ClientSection";
import { ColorPicker } from "./ColorPicker";
import { RatesSection } from "./RatesSection";

type Tab = "general" | "project";

/** Settings for the app as a whole and for the current project, split into
 *  tabs: the "from" block on an invoice is the same whichever project you
 *  bill, while the client and rates belong to one project. */
export function SettingsPanel() {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const updateProject = useAppStore((s) => s.updateProject);
  const project = projects.find((p) => p.id === currentProjectId);

  const [tab, setTab] = useState<Tab>("project");
  const [name, setName] = useState(project?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!project) return null;

  const commitName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }
    setError(null);
    if (trimmed === project.name) return;
    try {
      await updateProject(project.id, { name: trimmed });
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't rename the project. Please try again."));
    }
  };

  const commitColor = async (color: string) => {
    setError(null);
    try {
      await updateProject(project.id, { color });
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't change the color. Please try again."));
    }
  };

  return (
    <Modal title="Settings" onClose={closeSettings}>
      <div className="settings-tabs" role="tablist">
        <button
          className={`nav-btn${tab === "general" ? " active" : ""}`}
          role="tab"
          aria-selected={tab === "general"}
          onClick={() => setTab("general")}
        >
          General
        </button>
        <button
          className={`nav-btn${tab === "project" ? " active" : ""}`}
          role="tab"
          aria-selected={tab === "project"}
          onClick={() => setTab("project")}
        >
          {project.name}
        </button>
      </div>

      {tab === "general" ? (
        <BillerSection />
      ) : (
        <>
          <div className="form-row">
            <label htmlFor="settings-name">Name</label>
            <input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void commitName()}
            />
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="form-row">
            <label>Color</label>
            <ColorPicker value={project.color} onChange={(color) => void commitColor(color)} />
          </div>
          <RatesSection projectId={project.id} />
          <ClientSection projectId={project.id} />
        </>
      )}

      <div className="modal-actions">
        <button className="btn" onClick={closeSettings}>
          Done
        </button>
      </div>
    </Modal>
  );
}
