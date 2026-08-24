import { formatAmount, formatInvoiceDate, formatInvoiceHours } from "../lib/invoice";
import { addressLinesOf, LAYOUT, pct, totalsRows, type InvoiceDoc } from "./invoiceModel";

const headerW = pct(LAYOUT.headerCols);
const itemW = pct(LAYOUT.itemCols);
const totalsW = pct(LAYOUT.totalsCols);

/** On-screen twin of InvoicePdfDocument. Both read the same InvoiceDoc and the
 *  same LAYOUT constants, so what you see here is what gets exported. */
export function InvoicePreview({ doc }: { doc: InvoiceDoc }) {
  return (
    <div className="invoice-sheet">
      <table className="invoice-table">
        <colgroup>
          {headerW.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          <tr>
            <td>
              <div className="invoice-name">{doc.from.name}</div>
              {addressLinesOf(doc.from).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {doc.from.phone ? <div>{doc.from.phone}</div> : null}
            </td>
            <td className="right">
              <div>Invoice #: {doc.number}</div>
              <div>Invoice Date: (mm-dd-yyyy) {formatInvoiceDate(doc.invoiceDate)}</div>
              <div>
                Invoice Period: (mm-dd-yyyy) {formatInvoiceDate(doc.periodStart)} to{" "}
                {formatInvoiceDate(doc.periodEnd)}
              </div>
              <div>Amount Due: ${formatAmount(doc.amountDue)}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="invoice-bill-to">
        <div className="invoice-bill-to-label">Bill To:</div>
        <div className="invoice-bill-to-body">
          <div>{doc.client.name}</div>
          {addressLinesOf(doc.client).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      <table className="invoice-table invoice-items">
        <colgroup>
          {itemW.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th className="right">Hours worked</th>
            <th className="right">Hourly rate ($)</th>
            <th className="right">Amount ($)</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line, i) => (
            <tr key={i}>
              <td>{line.item}</td>
              <td>{line.description}</td>
              <td className="right">{formatInvoiceHours(line.hours)}</td>
              <td className="right">{formatAmount(line.rate)}</td>
              <td className="right">{formatAmount(line.amount)}</td>
            </tr>
          ))}
          {doc.lines.length === 0 && (
            <tr>
              <td colSpan={5} className="invoice-empty">
                No billable hours in this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <table className="invoice-table invoice-totals">
        <colgroup>
          {totalsW.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          {totalsRows(doc).map((row) => (
            <tr key={row.label}>
              <td />
              <td className="right">{row.label}</td>
              <td className="right">${formatAmount(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
