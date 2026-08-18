import { useEffect, useRef } from "react";
import { addEntry } from "../../db/entriesRepo";
import { useEntriesRange } from "../../hooks/useEntriesRange";
import { formatDateKey } from "../../lib/format";
import { toQuarters } from "../../lib/validation";
import { useAppStore } from "../../store/appStore";
import { EntryEditor } from "./EntryEditor";

const WIDTH = 320;
const EDGE = 8;
const EST_HEIGHT = 190; // rough bubble height, for the above/below flip

/** Quick-add bubble anchored to today's tapped cell — the same add-entry
 *  editor the day panel offers, one tap sooner. */
export function QuickAddPopover() {
  const quickAdd = useAppStore((s) => s.quickAdd);
  const projectId = useAppStore((s) => s.currentProjectId);
  const closeQuickAdd = useAppStore((s) => s.closeQuickAdd);
  const bumpData = useAppStore((s) => s.bumpData);
  const dateKey = quickAdd?.dateKey ?? "";
  const { entries } = useEntriesRange(quickAdd && projectId ? projectId : null, dateKey, dateKey);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!quickAdd) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // a re-render during the event can detach the clicked node (e.g. picking
      // a task suggestion unmounts the dropdown) — that's not an outside click
      if (!document.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) closeQuickAdd();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [quickAdd, closeQuickAdd]);

  if (!quickAdd || !projectId) return null;

  const { anchor } = quickAdd;
  const anchorCenterX = anchor.left + anchor.width / 2;
  const below = anchor.bottom + EST_HEIGHT + EDGE < window.innerHeight;
  const left = Math.min(
    Math.max(anchorCenterX, EDGE + WIDTH / 2),
    window.innerWidth - EDGE - WIDTH / 2,
  );
  // keep the arrow on the tapped cell even when the bubble clamps at an edge
  const arrowLeft = Math.min(Math.max(anchorCenterX - (left - WIDTH / 2), 16), WIDTH - 16);

  const otherQuarters = entries.reduce((sum, e) => sum + toQuarters(e.hours), 0);

  return (
    <div
      ref={ref}
      className={`quick-add-popover ${below ? "below" : "above"}`}
      role="dialog"
      aria-label="Add entry for today"
      style={{
        width: WIDTH,
        left,
        top: below ? anchor.bottom + 10 : anchor.top - 10,
        transform: below ? "translateX(-50%)" : "translate(-50%, -100%)",
      }}
    >
      <span className="quick-add-arrow" style={{ left: arrowLeft }} />
      <div className="quick-add-title">
        Add entry · {formatDateKey(quickAdd.dateKey, "EEE, MMM d")}
      </div>
      <EntryEditor
        projectId={projectId}
        otherQuarters={otherQuarters}
        onCancel={closeQuickAdd}
        onSave={async (hours, task) => {
          await addEntry({ projectId, date: quickAdd.dateKey, hours, task });
          bumpData();
          closeQuickAdd();
        }}
      />
    </div>
  );
}
