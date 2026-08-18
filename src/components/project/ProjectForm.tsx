import { useState } from "react";
import { userErrorMessage } from "../../lib/errors";
import { validateRate } from "../../lib/validation";
import { DEFAULT_PROJECT_COLOR } from "../../theme/tokens";
import { ColorPicker } from "./ColorPicker";

export interface ProjectFormValues {
  name: string;
  color: string;
  initialRate: number | null;
}

/** Create/edit form. `withRate` shows the optional initial-rate field (project
 *  creation only — rate history is managed in settings afterwards). */
export function ProjectForm(props: {
  withRate: boolean;
  initial?: { name: string; color: string };
  submitLabel: string;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(props.initial?.name ?? "");
  const [color, setColor] = useState(props.initial?.color ?? DEFAULT_PROJECT_COLOR);
  const [rateText, setRateText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }
    let initialRate: number | null = null;
    if (props.withRate && rateText.trim() !== "") {
      const parsed = Number(rateText);
      const check = validateRate(parsed);
      if (!check.ok) {
        setError(check.reason);
        return;
      }
      initialRate = parsed;
    }
    setBusy(true);
    setError(null);
    try {
      await props.onSubmit({ name: trimmed, color, initialRate });
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't save the project. Please try again."));
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="form-row">
        <label htmlFor="project-name">Name</label>
        <input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="form-row">
        <label>Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {props.withRate && (
        <div className="form-row">
          <label htmlFor="project-rate">Hourly rate ($) — optional</label>
          <input
            id="project-rate"
            inputMode="decimal"
            placeholder="e.g. 85.00"
            value={rateText}
            onChange={(e) => setRateText(e.target.value)}
          />
          <span className="form-hint">
            Leave empty for no rate. Applies from today; manage rate history in
            project settings later.
          </span>
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        {props.onCancel && (
          <button type="button" className="btn" onClick={props.onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {props.submitLabel}
        </button>
      </div>
    </form>
  );
}
