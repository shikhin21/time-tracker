import { useMemo, useState } from "react";
import {
  snapToQuarter,
  toQuarters,
  validateDayTotal,
  validateEntryHours,
} from "../../lib/validation";

/** Inline editor for one entry: hours (quarter-snapped) + optional task.
 *  `otherQuarters` is the day's total excluding this entry, for the ≤24h check. */
export function EntryEditor(props: {
  initialHours?: number;
  initialTask?: string | null;
  otherQuarters: number;
  onSave: (hours: number, task: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [hoursText, setHoursText] = useState(
    props.initialHours !== undefined ? String(props.initialHours) : "",
  );
  const [task, setTask] = useState(props.initialTask ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputError = useMemo(() => {
    if (hoursText.trim() === "") return "Enter hours (0.25 steps; 0 is allowed).";
    const parsed = Number(hoursText);
    const hoursCheck = validateEntryHours(parsed);
    if (!hoursCheck.ok) return hoursCheck.reason;
    const dayCheck = validateDayTotal(props.otherQuarters, toQuarters(parsed));
    if (!dayCheck.ok) return dayCheck.reason;
    return null;
  }, [hoursText, props.otherQuarters]);

  const snapOnBlur = () => {
    const parsed = Number(hoursText);
    if (hoursText.trim() !== "" && Number.isFinite(parsed) && parsed >= 0) {
      setHoursText(String(snapToQuarter(parsed)));
    }
  };

  const save = async () => {
    if (inputError) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await props.onSave(Number(hoursText), task.trim() === "" ? null : task.trim());
    } catch (e) {
      setSubmitError(String(e instanceof Error ? e.message : e));
      setBusy(false);
    }
  };

  return (
    <form
      className="entry-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="entry-editor-fields">
        <input
          className="entry-hours-input"
          aria-label="Hours"
          placeholder="Hours"
          inputMode="decimal"
          autoFocus
          value={hoursText}
          onChange={(e) => setHoursText(e.target.value)}
          onBlur={snapOnBlur}
        />
        <input
          className="entry-task-input"
          aria-label="Task"
          placeholder="Task (optional)"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
      </div>
      {(inputError || submitError) && (
        <div className="form-error">{submitError ?? inputError}</div>
      )}
      <div className="entry-editor-actions">
        <button type="button" className="btn btn-ghost" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || inputError !== null}
        >
          Save
        </button>
      </div>
    </form>
  );
}
