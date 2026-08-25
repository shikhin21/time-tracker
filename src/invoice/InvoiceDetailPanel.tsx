import { useEffect, useState } from "react";
import { getInvoiceWithLines } from "../db/invoicesRepo";
import { userErrorMessage } from "../lib/errors";
import { useAppStore } from "../store/appStore";
import { exportInvoicePdf } from "./exportInvoice";
import { InvoicePreview } from "./InvoicePreview";
import { docFromStoredInvoice, type InvoiceDoc } from "./invoiceModel";

/** The detail half of the invoices view.
 *
 *  Built from the invoice's own stored rows — never recomputed from entries and
 *  rates — so it shows what was actually sent however much the hours, rates or
 *  client details have moved on since. */
export function InvoiceDetailPanel({ invoiceId }: { invoiceId: string }) {
  const closeInvoice = useAppStore((s) => s.closeInvoice);

  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setSavedTo(null);
    setError(null);
    void getInvoiceWithLines(invoiceId)
      .then((found) => {
        if (cancelled) return;
        if (!found) setError("That invoice is no longer in your history.");
        else setDoc(docFromStoredInvoice(found.invoice, found.lines));
      })
      .catch((e) => {
        if (!cancelled) setError(userErrorMessage(e, "Couldn't open that invoice."));
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector(".modal-backdrop")) {
        closeInvoice();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeInvoice]);

  /** Writes the file again from the same snapshot. It doesn't touch the
   *  ledger, so saving another copy can't consume a number. */
  const saveAgain = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const path = await exportInvoicePdf(doc);
      if (path) setSavedTo(path);
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't save the PDF."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="invoice-panel" aria-label="Invoice">
      <div className="day-panel-header">
        <div>
          <div className="day-panel-title">{doc ? `Invoice #${doc.number}` : "Invoice"}</div>
          <div className="day-panel-date">
            Reproduction of what was recorded when this invoice was issued.
          </div>
        </div>
        <button className="icon-btn" aria-label="Close" onClick={closeInvoice}>
          ✕
        </button>
      </div>

      <div className="invoice-panel-body">
        {error && <div className="form-error">{error}</div>}
        {doc && <InvoicePreview doc={doc} />}
        {savedTo && <div className="invoice-saved">Saved to {savedTo}</div>}
      </div>

      {doc && (
        <div className="invoice-panel-actions">
          <button className="btn btn-neutral" disabled={busy} onClick={() => void saveAgain()}>
            {busy ? "Saving…" : "Save PDF again"}
          </button>
        </div>
      )}
    </aside>
  );
}
