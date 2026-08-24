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
  periodStart: string;
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

/** How many calendar months a period touches: 1 when it stays inside one
 *  month, 0 or less when the dates are reversed. */
export function monthsSpanned(periodStart: string, periodEnd: string): number {
  const [startYear, startMonth] = periodStart.split("-").map(Number);
  const [endYear, endMonth] = periodEnd.split("-").map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
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

  // reversed dates cover nothing at all, so there's no sensible invoice to
  // waive your way to — this one has to be corrected
  if (input.periodEnd < input.periodStart) {
    blockers.push({
      id: "period-reversed",
      message: `The billing period ends before it starts — ${formatInvoiceDate(input.periodStart)} to ${formatInvoiceDate(input.periodEnd)}.`,
    });
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

  const months = monthsSpanned(input.periodStart, input.periodEnd);
  if (months > 1) {
    blockers.push({
      id: "period-multi-month",
      message: `The billing period covers ${months} months — ${formatInvoiceDate(input.periodStart)} to ${formatInvoiceDate(input.periodEnd)}.`,
      detail:
        "Invoices normally cover a single month; check this doesn’t overlap one you’ve already issued.",
      action: "Invoice the whole span",
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
