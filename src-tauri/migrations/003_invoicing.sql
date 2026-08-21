-- Invoicing: client billing details per project, plus an immutable invoice
-- ledger. Purely additive — no existing table is touched.

CREATE TABLE clients (
  id           TEXT PRIMARY KEY,
  projectId    TEXT NOT NULL REFERENCES projects(id),
  name         TEXT NOT NULL,
  addressLines TEXT NOT NULL,
  createdAt    INTEGER NOT NULL,
  updatedAt    INTEGER NOT NULL,
  UNIQUE (projectId)          -- one client per project
);

-- Every monetary and descriptive value is snapshotted at export time, so an
-- invoice is fully reconstructable from its own rows: later edits to entries
-- or rates never alter an invoice already issued.
CREATE TABLE invoices (
  id             TEXT PRIMARY KEY,
  projectId      TEXT NOT NULL REFERENCES projects(id),
  number         TEXT NOT NULL,
  invoiceDate    TEXT NOT NULL,   -- "YYYY-MM-DD"
  periodStart    TEXT NOT NULL,   -- "YYYY-MM-DD"
  periodEnd      TEXT NOT NULL,   -- "YYYY-MM-DD"
  subtotal       REAL NOT NULL,
  salesTax       REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL,
  payments       REAL NOT NULL DEFAULT 0,
  amountDue      REAL NOT NULL,
  fromSnapshot   TEXT NOT NULL,   -- json: biller details as they were
  clientSnapshot TEXT NOT NULL,   -- json: client details as they were
  createdAt      INTEGER NOT NULL,
  updatedAt      INTEGER NOT NULL
);
CREATE INDEX idx_invoices_project_period ON invoices(projectId, periodStart, periodEnd);

CREATE TABLE invoice_line_items (
  id          TEXT PRIMARY KEY,
  invoiceId   TEXT NOT NULL REFERENCES invoices(id),
  item        TEXT NOT NULL,
  description TEXT NOT NULL,
  periodStart TEXT NOT NULL,      -- "YYYY-MM-DD" — this line's rate-period
  periodEnd   TEXT NOT NULL,
  hours       REAL NOT NULL,
  rate        REAL NOT NULL,
  amount      REAL NOT NULL,
  sortOrder   INTEGER NOT NULL
);
CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoiceId, sortOrder);
