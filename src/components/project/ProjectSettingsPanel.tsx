import { useState } from "react";
import { userErrorMessage } from "../../lib/errors";
import { useAppStore } from "../../store/appStore";
import { Modal } from "../shared/Modal";
import { ColorPicker } from "./ColorPicker";
import { RatesSection } from "./RatesSection";

export function ProjectSettingsPanel() {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const updateProject = useAppStore((s) => s.updateProject);
  const project = projects.find((p) => p.id === currentProjectId);

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
    <Modal title="Project settings" onClose={closeSettings}>
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
      <div className="modal-actions">
        <button className="btn" onClick={closeSettings}>
          Done
        </button>
      </div>
    </Modal>
  );
}
