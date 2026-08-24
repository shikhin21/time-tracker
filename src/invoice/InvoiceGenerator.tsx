import { useEffect, useMemo, useState } from "react";
import { getBillerDetails, getClient } from "../db/clientsRepo";
import { getEntriesInRange } from "../db/entriesRepo";
import { createInvoice, getInvoiceNumbers, getInvoicesForPeriod } from "../db/invoicesRepo";
import { getRates } from "../db/ratesRepo";
import type { InvoiceRow } from "../db/db";
import { monthEndKey, todayKey } from "../lib/dates";
import { userErrorMessage } from "../lib/errors";
import {
  computeInvoice,
  formatAmount,
  formatInvoiceDate,
  formatInvoiceHours,
  nextInvoiceNumber,
  type InvoiceComputation,
} from "../lib/invoice";
import { useAppStore } from "../store/appStore";
import { Modal } from "../components/shared/Modal";
import { exportInvoicePdf } from "./exportInvoice";
import { InvoicePreview } from "./InvoicePreview";
import { billerToParty, type InvoiceDoc, type InvoiceParty } from "./invoiceModel";

interface Loaded {
  from: InvoiceParty;
  client: InvoiceParty;
  computation: InvoiceComputation;
  suggestedNumber: string | null;
  existing: InvoiceRow[];
}

export function InvoiceGenerator({ monthKey, onClose }: { monthKey: string; onClose: () => void }) {
  const projectId = useAppStore((s) => s.currentProjectId);
  const bumpData = useAppStore((s) => s.bumpData);

  const defaultStart = `${monthKey}-01`;
  const defaultEnd = monthEndKey(monthKey);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [number, setNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayKey());
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [acknowledgedExisting, setAcknowledgedExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);

  // Recomputed whenever the period changes, so editing the dates re-groups the
  // rate-periods rather than showing stale lines.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const [entries, rates, client, from, numbers, existing] = await Promise.all([
          getEntriesInRange(projectId, periodStart, periodEnd),
          getRates(projectId),
          getClient(projectId),
          getBillerDetails(),
          getInvoiceNumbers(projectId),
          getInvoicesForPeriod(projectId, periodStart, periodEnd),
        ]);
        if (cancelled) return;
        const suggested = nextInvoiceNumber(numbers);
        setLoaded({
          from: billerToParty(from),
          client: {
            name: client?.name ?? "",
            addressLines: client?.addressLines ?? "",
          },
          computation: computeInvoice(entries, rates, periodStart, periodEnd),
          suggestedNumber: suggested,
          existing,
        });
        setNumber((current) => current || suggested || "");
      } catch (e) {
        if (!cancelled) setError(userErrorMessage(e, "Couldn't prepare the invoice."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, periodStart, periodEnd]);

  const doc: InvoiceDoc | null = useMemo(() => {
    if (!loaded) return null;
    const c = loaded.computation;
    return {
      from: loaded.from,
      client: loaded.client,
      number,
      invoiceDate,
      periodStart,
      periodEnd,
      lines: c.lines,
      subtotal: c.subtotal,
      salesTax: c.salesTax,
      total: c.total,
      payments: c.payments,
      amountDue: c.amountDue,
    };
  }, [loaded, number, invoiceDate, periodStart, periodEnd]);

  if (!projectId) return null;

  const existing = loaded?.existing ?? [];
  const mustAcknowledge = existing.length > 0 && !acknowledgedExisting;
  const firstEver = loaded !== null && loaded.suggestedNumber === null;
  const canExport = doc !== null && number.trim() !== "" && !mustAcknowledge && !busy;

  /** Export is the only thing that commits the snapshot and consumes the
   *  number — preview is free and repeatable (§7). */
  const onExport = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const path = await exportInvoicePdf(doc);
      if (!path) return; // user cancelled the save dialog — nothing is recorded
      await createInvoice({
        projectId,
        number: doc.number.trim(),
        invoiceDate: doc.invoiceDate,
        periodStart: doc.periodStart,
        periodEnd: doc.periodEnd,
        subtotal: doc.subtotal,
        salesTax: doc.salesTax,
        total: doc.total,
        payments: doc.payments,
        amountDue: doc.amountDue,
        fromSnapshot: JSON.stringify(doc.from),
        clientSnapshot: JSON.stringify(doc.client),
        lines: doc.lines,
      });
      bumpData();
      setSavedTo(path);
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't export the invoice."));
    } finally {
      setBusy(false);
    }
  };

  const unrated = loaded?.computation.unratedDates ?? [];
  // an invoice with a blank from- or bill-to block is not a usable invoice
  const missingParties = [
    loaded && !loaded.from.name.trim() ? "your details" : null,
    loaded && !loaded.client.name.trim() ? "the client" : null,
  ].filter((v): v is string => v !== null);

  return (
    <Modal title="Generate invoice" onClose={onClose} wide>
      <div className="invoice-generator">
        {existing.length > 0 && (
          <div className="invoice-warning">
            <strong>
              Invoice #{existing[0].number} already covers{" "}
              {formatInvoiceDate(existing[0].periodStart)} to{" "}
              {formatInvoiceDate(existing[0].periodEnd)}
            </strong>
            <div>
              Generated on {formatInvoiceDate(existing[0].invoiceDate)}. Regenerating issues a
              new, superseding invoice with a new number — the earlier one stays in your
              history untouched.
            </div>
            {!acknowledgedExisting && (
              <button className="btn" onClick={() => setAcknowledgedExisting(true)}>
                Regenerate anyway
              </button>
            )}
          </div>
        )}

        {unrated.length > 0 && (
          <div className="invoice-warning">
            <strong>
              {formatInvoiceHours(loaded?.computation.unratedHours ?? 0)} hours on{" "}
              {unrated.length} {unrated.length === 1 ? "day" : "days"} can’t be billed — no rate
              was in effect.
            </strong>
            <div>{unrated.map(formatInvoiceDate).join(", ")}</div>
            <div>
              Set a rate covering {unrated.length === 1 ? "that date" : "those dates"} in
              Settings, or export without those hours.
            </div>
          </div>
        )}

        {missingParties.length > 0 && (
          <div className="invoice-warning">
            <strong>Missing billing details</strong>
            <div>
              The invoice will print with {missingParties.join(" and ")} blank. Add{" "}
              {missingParties.length > 1 ? "them" : "that"} in Settings — your details under
              General, the client under the project’s tab.
            </div>
          </div>
        )}

        {firstEver && (
          <p className="form-hint">
            This is the first invoice for this project — enter the number to start the sequence
            from (e.g. 036). Later invoices count up from there.
          </p>
        )}

        <div className="invoice-fields">
          <div className="form-row">
            <label htmlFor="invoice-number">Invoice #</label>
            <input
              id="invoice-number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="invoice-date">Invoice date</label>
            <input
              id="invoice-date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="period-start">Period start</label>
            <input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="period-end">Period end</label>
            <input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>

        {doc ? <InvoicePreview doc={doc} /> : <p className="form-hint">Preparing…</p>}

        {error && <div className="form-error">{error}</div>}
        {savedTo && (
          <div className="invoice-saved">
            Saved to {savedTo} — invoice #{doc?.number} recorded.
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {savedTo ? "Done" : "Cancel"}
          </button>
          <button className="btn btn-primary" disabled={!canExport} onClick={() => void onExport()}>
            {busy ? "Exporting…" : `Export PDF ($${formatAmount(doc?.amountDue ?? 0)})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
