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
  /** Invoices that may touch this period, most recent first. Re-checked here
   *  rather than trusted, so the warning holds even if the query is widened. */
  priorInvoices: PriorInvoice[];
  /** Every number this project has issued — numbers are unique per project. */
  usedNumbers: string[];
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

  const number = input.number.trim();
  if (number === "") {
    blockers.push({ id: "number", message: "Enter an invoice number." });
  } else if (input.usedNumbers.some((used) => used.trim() === number)) {
    // the db enforces this too, so waiving it could only fail at the last step
    blockers.push({
      id: "number-taken",
      message: `Invoice #${number} already exists for this project.`,
      detail: "Numbers are unique per project.",
    });
  }

  // reversed dates cover nothing at all, so there's no sensible invoice to
  // waive your way to — this one has to be corrected
  if (input.periodEnd < input.periodStart) {
    blockers.push({
      id: "period-reversed",
      message: `The billing period ends before it starts — ${formatInvoiceDate(input.periodStart)} to ${formatInvoiceDate(input.periodEnd)}.`,
    });
  }

  // an exact re-issue is a different situation from a partial overlap: the
  // first supersedes a period you meant to bill, the second double-bills days
  const sameSpan = (p: PriorInvoice) =>
    p.periodStart === input.periodStart && p.periodEnd === input.periodEnd;
  const touchesSpan = (p: PriorInvoice) =>
    p.periodStart <= input.periodEnd && p.periodEnd >= input.periodStart;

  const reissued = input.priorInvoices.filter(sameSpan);
  const overlapping = input.priorInvoices.filter((p) => !sameSpan(p) && touchesSpan(p));

  const prior = reissued[0];
  if (prior) {
    blockers.push({
      id: "already-invoiced",
      message: `Invoice #${prior.number} already covers ${formatInvoiceDate(prior.periodStart)} to ${formatInvoiceDate(prior.periodEnd)}, generated ${formatInvoiceDate(prior.invoiceDate)}.`,
      detail: "A new invoice supersedes it; the earlier one stays in your history untouched.",
      action: "Issue a new, superseding invoice",
    });
  }

  const clash = overlapping[0];
  if (clash) {
    const others = overlapping.length - 1;
    blockers.push({
      id: "period-overlaps",
      message: `Invoice #${clash.number} covers ${formatInvoiceDate(clash.periodStart)} to ${formatInvoiceDate(clash.periodEnd)}, which overlaps this period${others > 0 ? `, as ${others === 1 ? "does 1 other invoice" : `do ${others} other invoices`}` : ""}.`,
      detail: "Hours in the overlapping days would be billed on both invoices.",
      action: "Bill the overlapping days again",
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
