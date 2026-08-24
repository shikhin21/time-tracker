import { useEffect, useState } from "react";
import type { InvoiceRow } from "../db/db";
import { getInvoices, getInvoiceWithLines } from "../db/invoicesRepo";
import { userErrorMessage } from "../lib/errors";
import { formatAmount, formatInvoiceDate } from "../lib/invoice";
import { useAppStore } from "../store/appStore";
import { Modal } from "../components/shared/Modal";
import { exportInvoicePdf } from "./exportInvoice";
import { InvoicePreview } from "./InvoicePreview";
import { docFromStoredInvoice, type InvoiceDoc } from "./invoiceModel";

/** Every invoice issued for this project, and a reprint of any one of them.
 *
 *  A reprint is built from the invoice's own stored rows — never recomputed
 *  from entries and rates — so an invoice shows what was actually sent however
 *  much the hours, rates or client details have changed since. */
export function InvoiceHistory({ onClose }: { onClose: () => void }) {
  const projectId = useAppStore((s) => s.currentProjectId);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [opened, setOpened] = useState<{ doc: InvoiceDoc; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void getInvoices(projectId)
      .then((rows) => {
        if (!cancelled) setInvoices(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(userErrorMessage(e, "Couldn't load your invoices."));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, dataVersion]);

  const openInvoice = async (id: string) => {
    setError(null);
    setSavedTo(null);
    try {
      const found = await getInvoiceWithLines(id);
      if (!found) {
        setError("That invoice is no longer in your history.");
        return;
      }
      setOpened({ doc: docFromStoredInvoice(found.invoice, found.lines), id });
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't open that invoice."));
    }
  };

  /** Writes the file again from the same snapshot. It doesn't touch the
   *  ledger, so saving another copy can't consume a number. */
  const saveAgain = async () => {
    if (!opened) return;
    setBusy(true);
    setError(null);
    try {
      const path = await exportInvoicePdf(opened.doc);
      if (path) setSavedTo(path);
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't save the PDF."));
    } finally {
      setBusy(false);
    }
  };

  if (opened) {
    return (
      <Modal title={`Invoice #${opened.doc.number}`} onClose={onClose} wide>
        <div className="invoice-generator">
          <p className="form-hint">
            Reproduction of what was recorded when this invoice was issued.
          </p>
          <InvoicePreview doc={opened.doc} />
          {error && <div className="form-error">{error}</div>}
          {savedTo && <div className="invoice-saved">Saved to {savedTo}</div>}
          <div className="modal-actions">
            <button className="btn" onClick={() => setOpened(null)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void saveAgain()}>
              {busy ? "Saving…" : "Save PDF again"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Invoices" onClose={onClose}>
      {error && <div className="form-error">{error}</div>}
      {invoices === null ? (
        <p className="form-hint">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="form-hint">
          No invoices yet. Generate one from the month view — it’s recorded here when you
          export it.
        </p>
      ) : (
        <ul className="invoice-list">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <button className="invoice-list-row" onClick={() => void openInvoice(invoice.id)}>
                <span className="invoice-list-number">#{invoice.number}</span>
                <span className="invoice-list-period">
                  {formatInvoiceDate(invoice.periodStart)} to{" "}
                  {formatInvoiceDate(invoice.periodEnd)}
                </span>
                <span className="invoice-list-date">
                  issued {formatInvoiceDate(invoice.invoiceDate)}
                </span>
                <span className="invoice-list-amount">${formatAmount(invoice.amountDue)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
