import { formatDateKey, formatRate } from "../../lib/format";
import type { RateChange, RateImpact } from "../../lib/rates";
import { Modal } from "../shared/Modal";

const fmtDate = (key: string) => formatDateKey(key, "MMM d, yyyy");
const fmtRate = (rate: number | null) => (rate === null ? "no rate" : formatRate(rate));

function segmentLabel(fromDate: string, toDate: string | null): string {
  return toDate === null
    ? `From ${fmtDate(fromDate)} onward`
    : fromDate === toDate
      ? fmtDate(fromDate)
      : `${fmtDate(fromDate)} – ${fmtDate(toDate)}`;
}

const TITLES: Record<RateChange["type"], string> = {
  add: "Add rate?",
  edit: "Change rate?",
  delete: "Delete rate?",
};

/** The required "show what's affected" confirmation: rate resolution is
 *  retroactive, so every rate-history change previews its impact first. */
export function RateImpactDialog(props: {
  change: RateChange;
  impact: RateImpact;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { impact } = props;
  return (
    <Modal title={TITLES[props.change.type]} onClose={props.onCancel}>
      {impact.segments.length === 0 ? (
        <p className="impact-none">No day changes its effective rate.</p>
      ) : (
        <>
          <p className="impact-intro">This changes the effective rate for:</p>
          <ul className="impact-segments">
            {impact.segments.map((seg) => (
              <li key={seg.fromDate}>
                <span className="impact-span">{segmentLabel(seg.fromDate, seg.toDate)}</span>
                <span className="impact-rates">
                  {fmtRate(seg.oldRate)} → <strong>{fmtRate(seg.newRate)}</strong>
                </span>
              </li>
            ))}
          </ul>
          <p className="impact-entries">
            {impact.affectedEntryCount === 0
              ? "No logged entries fall in this span."
              : `Affects ${impact.affectedEntryCount} logged ${
                  impact.affectedEntryCount === 1 ? "entry" : "entries"
                } (${fmtDate(impact.affectedFrom!)}${
                  impact.affectedTo !== impact.affectedFrom
                    ? ` – ${fmtDate(impact.affectedTo!)}`
                    : ""
                }).`}
          </p>
          {impact.becomesNoRate && (
            <p className="impact-warning">
              Part of this span will have <strong>no rate set</strong> afterwards.
            </p>
          )}
        </>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          className={`btn ${props.change.type === "delete" ? "btn-danger" : "btn-primary"}`}
          onClick={props.onConfirm}
        >
          {props.change.type === "delete" ? "Delete" : "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
