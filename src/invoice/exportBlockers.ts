import { formatAmount, formatInvoiceDate, formatInvoiceHours } from "../lib/invoice";

/** A reason the invoice can't be exported yet. `action` is the label of the
 *  checkbox that waives it; without one, the reason has to be fixed rather
 *  than acknowledged. */
export interface ExportBlocker {
  id: string;
  message: string;
  detail?: string;
  action?: string;
}

export interface PriorInvoice {
  number: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
}

export interface BlockerInput {
  loaded: boolean;
  number: string;
  /** Local today, as a date key — passed in so this stays pure. */
  today: string;
  periodEnd: string;
  lineCount: number;
  amountDue: number;
  unratedDates: string[];
  unratedHours: number;
  fromName: string;
  clientName: string;
  /** Invoices already covering this exact period, most recent first. */
  existing: PriorInvoice[];
}

/** Everything standing between the user and a correct invoice, in the order
 *  it's worth reading: what must be fixed first, then what can be waived. */
export function exportBlockers(input: BlockerInput): ExportBlocker[] {
  if (!input.loaded) {
    return [{ id: "loading", message: "Still preparing the invoice…" }];
  }

  const blockers: ExportBlocker[] = [];

  if (input.number.trim() === "") {
    blockers.push({ id: "number", message: "Enter an invoice number." });
  }

  const prior = input.existing[0];
  if (prior) {
    blockers.push({
      id: "already-invoiced",
      message: `Invoice #${prior.number} already covers ${formatInvoiceDate(prior.periodStart)} to ${formatInvoiceDate(prior.periodEnd)}, generated ${formatInvoiceDate(prior.invoiceDate)}.`,
      detail: "A new invoice supersedes it; the earlier one stays in your history untouched.",
      action: "Issue a new, superseding invoice",
    });
  }

  // strictly in the future: invoicing on the period's last day is fine
  if (input.periodEnd > input.today) {
    blockers.push({
      id: "period-open",
      message: `The billing period hasn’t ended yet — it runs to ${formatInvoiceDate(input.periodEnd)}.`,
      detail: "Hours logged between now and then won’t appear on this invoice.",
      action: "Invoice the period early",
    });
  }

  if (input.lineCount === 0) {
    blockers.push({
      id: "nothing-billable",
      message: `No billable hours in this period — the invoice would total $${formatAmount(input.amountDue)}.`,
      action: "Export a zero invoice",
    });
  }

  const missing = [
    input.fromName.trim() === "" ? "your details" : null,
    input.clientName.trim() === "" ? "the client" : null,
  ].filter((v): v is string => v !== null);
  if (missing.length > 0) {
    blockers.push({
      id: "missing-parties",
      message: `The invoice will print with ${missing.join(" and ")} blank.`,
      detail:
        "Add in Settings — your details under General, the client under the project’s tab.",
      action: "Export with blank blocks",
    });
  }

  if (input.unratedDates.length > 0) {
    const days = input.unratedDates.length;
    blockers.push({
      id: "unrated-days",
      message: `${formatInvoiceHours(input.unratedHours)} hours on ${days} ${days === 1 ? "day" : "days"} can’t be billed — no rate was in effect.`,
      detail: input.unratedDates.map(formatInvoiceDate).join(", "),
      action: "Export without those hours",
    });
  }

  return blockers;
}

/** Export is allowed when every reason is waivable and has been waived. */
export function canExport(blockers: ExportBlocker[], overridden: ReadonlySet<string>): boolean {
  return blockers.every((b) => b.action !== undefined && overridden.has(b.id));
}
