import { useAppStore } from "../../store/appStore";
import { Modal } from "../shared/Modal";
import { ProjectForm } from "./ProjectForm";

export function ProjectCreateModal(props: { onClose: () => void }) {
  const createProject = useAppStore((s) => s.createProject);
  return (
    <Modal title="New project" onClose={props.onClose}>
      <ProjectForm
        withRate
        submitLabel="Create project"
        onCancel={props.onClose}
        onSubmit={async (values) => {
          await createProject({
            name: values.name,
            color: values.color,
            initialRate: values.initialRate,
          });
          props.onClose();
        }}
      />
    </Modal>
  );
}
