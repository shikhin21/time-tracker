import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { addEntry } from "../../db/entriesRepo";
import { useEntriesRange } from "../../hooks/useEntriesRange";
import { formatDateKey } from "../../lib/format";
import { toQuarters } from "../../lib/validation";
import { useAppStore } from "../../store/appStore";
import { EntryEditor } from "./EntryEditor";

const WIDTH = 320;
const EDGE = 8;
const EST_HEIGHT = 190; // first-paint guess, before we can measure the real height

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
  // measured after every render, so it tracks content that grows (e.g. a
  // validation error appearing) instead of trusting the first-paint guess
  const [height, setHeight] = useState(EST_HEIGHT);

  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight);
  });

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

  // pick whichever side actually has more room, using the real measured
  // height — not just "does it fit below" — so a short-on-both-sides anchor
  // (e.g. a full-height week-day column) doesn't default to an overflowing
  // "above" placement
  const spaceBelow = window.innerHeight - anchor.bottom - EDGE;
  const spaceAbove = anchor.top - EDGE;
  const below = spaceBelow >= height || spaceBelow >= spaceAbove;

  // clamp fully inside the viewport even if neither side has enough room
  let top = below ? anchor.bottom + 10 : anchor.top - 10 - height;
  top = Math.min(Math.max(top, EDGE), window.innerHeight - EDGE - height);

  // last-resort safety net: if the chosen side is still too tight, cap the
  // bubble's height and let its content scroll instead of clipping off-screen
  const maxHeight = Math.max(120, below ? spaceBelow : spaceAbove);

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
        top,
        maxHeight,
        overflowY: "auto",
        transform: "translateX(-50%)",
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
