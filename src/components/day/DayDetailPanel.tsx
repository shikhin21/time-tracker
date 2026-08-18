import { useEffect, useState } from "react";
import { useEntriesRange } from "../../hooks/useEntriesRange";
import { addEntry, deleteEntry, updateEntry } from "../../db/entriesRepo";
import { userErrorMessage } from "../../lib/errors";
import { formatDateKey, formatQuarters } from "../../lib/format";
import { toQuarters } from "../../lib/validation";
import { useAppStore } from "../../store/appStore";
import { EntryEditor } from "./EntryEditor";

/** The single shared editable surface — opened from month or week view. */
export function DayDetailPanel(props: { dayKey: string }) {
  const projectId = useAppStore((s) => s.currentProjectId);
  const closeDay = useAppStore((s) => s.closeDay);
  const bumpData = useAppStore((s) => s.bumpData);
  const { entries } = useEntriesRange(props.dayKey && projectId ? projectId : null, props.dayKey, props.dayKey);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // an open modal or an entry editor (which preventDefaults) owns Escape
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        !document.querySelector(".modal-backdrop")
      ) {
        closeDay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDay]);

  const totalQuarters = entries.reduce((sum, e) => sum + toQuarters(e.hours), 0);
  const otherQuarters = (excludeId: string | null) =>
    entries
      .filter((e) => e.id !== excludeId)
      .reduce((sum, e) => sum + toQuarters(e.hours), 0);

  return (
    <aside className="day-panel" aria-label="Day details">
      <div className="day-panel-header">
        <div>
          <div className="day-panel-title">{formatDateKey(props.dayKey, "EEEE")}</div>
          <div className="day-panel-date">{formatDateKey(props.dayKey, "MMMM d, yyyy")}</div>
        </div>
        <button className="icon-btn" aria-label="Close" onClick={closeDay}>
          ✕
        </button>
      </div>

      <div className="day-panel-entries">
        {entries.length === 0 && !adding && (
          <div className="day-panel-empty">No entries for this day.</div>
        )}
        {entries.map((entry) =>
          editingId === entry.id ? (
            <EntryEditor
              key={entry.id}
              initialHours={entry.hours}
              initialTask={entry.task}
              otherQuarters={otherQuarters(entry.id)}
              onCancel={() => setEditingId(null)}
              onSave={async (hours, task) => {
                await updateEntry(entry.id, { hours, task });
                setEditingId(null);
                bumpData();
              }}
            />
          ) : (
            <div key={entry.id} className="entry-row">
              <span className="entry-hours">{formatQuarters(toQuarters(entry.hours))}h</span>
              <span className="entry-task">{entry.task ?? ""}</span>
              <button
                className="icon-btn"
                aria-label="Edit entry"
                onClick={() => {
                  setAdding(false);
                  setEditingId(entry.id);
                }}
              >
                ✎
              </button>
              <button
                className="icon-btn"
                aria-label="Delete entry"
                onClick={async () => {
                  try {
                    await deleteEntry(entry.id);
                    setPanelError(null);
                    bumpData();
                  } catch (e) {
                    setPanelError(
                      userErrorMessage(e, "Couldn't delete the entry. Please try again."),
                    );
                  }
                }}
              >
                🗑
              </button>
            </div>
          ),
        )}
        {adding && projectId && (
          <EntryEditor
            otherQuarters={otherQuarters(null)}
            onCancel={() => setAdding(false)}
            onSave={async (hours, task) => {
              await addEntry({ projectId, date: props.dayKey, hours, task });
              setAdding(false);
              bumpData();
            }}
          />
        )}
        {panelError && <div className="form-error">{panelError}</div>}
      </div>

      {!adding && (
        <button
          className="btn day-panel-add"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
        >
          + Add entry
        </button>
      )}

      <div className="day-panel-total">
        Day total: <strong>{formatQuarters(totalQuarters)}h</strong> / 24h
      </div>
    </aside>
  );
}
