import { useState } from "react";
import type { RateRow } from "../../db/db";
import { addRate, deleteRate, makeEntryCounter, updateRate } from "../../db/ratesRepo";
import { useRates } from "../../hooks/useRates";
import { todayKey } from "../../lib/dates";
import { userErrorMessage } from "../../lib/errors";
import { formatDateKey, formatRate } from "../../lib/format";
import {
  checkRateDateConflict,
  computeRateImpact,
  resolveRate,
  type RateChange,
  type RateImpact,
} from "../../lib/rates";
import { validateRate } from "../../lib/validation";
import { useAppStore } from "../../store/appStore";
import { RateImpactDialog } from "./RateImpactDialog";

function RateFields(props: {
  initialDate?: string;
  initialRate?: number;
  submitLabel: string;
  onSubmit: (effectiveDate: string, rate: number) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [date, setDate] = useState(props.initialDate ?? todayKey());
  const [rateText, setRateText] = useState(
    props.initialRate !== undefined ? String(props.initialRate) : "",
  );
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <form
      className="rate-fields"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = Number(rateText);
        if (rateText.trim() === "" || !validateRate(parsed).ok) {
          setLocalError(
            rateText.trim() === ""
              ? "Enter a rate."
              : validateRate(parsed).ok
                ? null
                : (validateRate(parsed) as { ok: false; reason: string }).reason,
          );
          return;
        }
        setLocalError(null);
        props.onSubmit(date, parsed);
      }}
    >
      <div className="rate-fields-inputs">
        <input
          type="date"
          aria-label="Effective date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          aria-label="Rate"
          placeholder="$/hour"
          inputMode="decimal"
          value={rateText}
          onChange={(e) => setRateText(e.target.value)}
        />
      </div>
      {(localError ?? props.error) && (
        <div className="form-error">{localError ?? props.error}</div>
      )}
      <div className="entry-editor-actions">
        <button type="button" className="btn btn-ghost" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {props.submitLabel}
        </button>
      </div>
    </form>
  );
}

export function RatesSection(props: { projectId: string }) {
  const rates = useRates(props.projectId);
  const bumpData = useAppStore((s) => s.bumpData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ change: RateChange; impact: RateImpact } | null>(
    null,
  );

  const current = resolveRate(rates, todayKey());

  /** Conflict pre-check → impact preview → confirmation dialog. */
  const propose = async (change: RateChange) => {
    setError(null);
    const conflict = checkRateDateConflict(rates, change);
    if (conflict) {
      setError(conflict);
      return;
    }
    try {
      const impact = await computeRateImpact(
        rates,
        change,
        makeEntryCounter(props.projectId),
      );
      setPending({ change, impact });
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't compute what this change affects. Please try again."));
    }
  };

  const commit = async () => {
    if (!pending) return;
    const { change } = pending;
    try {
      if (change.type === "add") {
        await addRate({
          projectId: props.projectId,
          effectiveDate: change.effectiveDate,
          rate: change.rate,
        });
      } else if (change.type === "edit") {
        await updateRate(change.rateId, {
          rate: change.newRate,
          effectiveDate: change.newEffectiveDate,
        });
      } else {
        await deleteRate(change.rateId);
      }
      setPending(null);
      setAdding(false);
      setEditingId(null);
      bumpData();
    } catch (e) {
      setPending(null);
      setError(userErrorMessage(e, "Couldn't update the rate. Please try again."));
    }
  };

  const editChange = (row: RateRow, date: string, rate: number): RateChange | null => {
    const change: RateChange = { type: "edit", rateId: row.id };
    if (rate !== row.rate) change.newRate = rate;
    if (date !== row.effectiveDate) change.newEffectiveDate = date;
    return change.newRate === undefined && change.newEffectiveDate === undefined
      ? null
      : change;
  };

  return (
    <section className="rates-section">
      <h3>Hourly rate</h3>
      <p className="rates-current">
        {current ? (
          <>
            Current rate: <strong>{formatRate(current.rate)}</strong>{" "}
            <span className="form-hint">
              (since {formatDateKey(current.effectiveDate, "MMM d, yyyy")})
            </span>
          </>
        ) : (
          <>
            Current rate: <strong>—</strong>{" "}
            <span className="form-hint">(no rate set)</span>
          </>
        )}
      </p>

      <div className="rates-list">
        {rates.map((row) =>
          editingId === row.id ? (
            <RateFields
              key={row.id}
              initialDate={row.effectiveDate}
              initialRate={row.rate}
              submitLabel="Save"
              error={error}
              onCancel={() => {
                setEditingId(null);
                setError(null);
              }}
              onSubmit={(date, rate) => {
                const change = editChange(row, date, rate);
                if (!change) {
                  setEditingId(null);
                  return;
                }
                void propose(change);
              }}
            />
          ) : (
            <div key={row.id} className="rate-row">
              <span className="rate-row-date">
                {formatDateKey(row.effectiveDate, "MMM d, yyyy")}
              </span>
              <span className="rate-row-value">{formatRate(row.rate)}</span>
              <button
                className="icon-btn"
                aria-label="Edit rate"
                onClick={() => {
                  setAdding(false);
                  setError(null);
                  setEditingId(row.id);
                }}
              >
                ✎
              </button>
              <button
                className="icon-btn"
                aria-label="Delete rate"
                onClick={() => void propose({ type: "delete", rateId: row.id })}
              >
                🗑
              </button>
            </div>
          ),
        )}
        {rates.length === 0 && !adding && (
          <div className="form-hint">No rates yet — days show “no rate set”.</div>
        )}
      </div>

      {adding ? (
        <RateFields
          submitLabel="Add rate"
          error={error}
          onCancel={() => {
            setAdding(false);
            setError(null);
          }}
          onSubmit={(date, rate) => void propose({ type: "add", effectiveDate: date, rate })}
        />
      ) : (
        <button
          className="btn"
          onClick={() => {
            setEditingId(null);
            setError(null);
            setAdding(true);
          }}
        >
          + Add rate
        </button>
      )}

      {pending && (
        <RateImpactDialog
          change={pending.change}
          impact={pending.impact}
          onConfirm={() => void commit()}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  );
}
