import { useEffect, useState } from "react";
import type { InvoiceRow } from "../../db/db";
import { getInvoices } from "../../db/invoicesRepo";
import { userErrorMessage } from "../../lib/errors";
import { formatAmount, formatInvoiceDate } from "../../lib/invoice";
import { describeInvoicePeriod } from "../../invoice/invoiceModel";
import { useAppStore } from "../../store/appStore";

/** Every invoice issued for this project, newest first. The list half of a
 *  list-detail pair: picking one opens it in the drawer, so invoices can be
 *  read one after another without stepping back out each time. */
export function InvoicesView() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const selectedInvoiceId = useAppStore((s) => s.selectedInvoiceId);
  const openInvoice = useAppStore((s) => s.openInvoice);

  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
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

  if (error) return <div className="form-error">{error}</div>;
  if (invoices === null) return <p className="form-hint">Loading…</p>;

  if (invoices.length === 0) {
    return (
      <div className="invoices-empty">
        <p>No invoices yet.</p>
        <p className="form-hint">
          Generate one from the month view — it’s recorded here when you export it.
        </p>
      </div>
    );
  }

  return (
    <div className="invoices-list" role="list">
      {invoices.map((invoice) => (
        <button
          key={invoice.id}
          role="listitem"
          className={`invoice-list-row${selectedInvoiceId === invoice.id ? " selected" : ""}`}
          onClick={() => openInvoice(invoice.id)}
        >
          <span className="invoice-list-number">#{invoice.number}</span>
          <span className="invoice-list-period">
            {describeInvoicePeriod(invoice.periodStart, invoice.periodEnd)}
          </span>
          <span className="invoice-list-date">
            issued {formatInvoiceDate(invoice.invoiceDate)}
          </span>
          <span className="invoice-list-amount">${formatAmount(invoice.amountDue)}</span>
        </button>
      ))}
    </div>
  );
}
