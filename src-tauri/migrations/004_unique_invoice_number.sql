-- One invoice number per project. The sequence is derived from the ledger
-- itself (the highest number issued), so two invoices sharing a number would
-- make "the next number" ambiguous and let a period be billed twice under one
-- reference.
--
-- A unique index enforces this exactly as a table constraint would, without
-- rebuilding the table — SQLite can't add a constraint to an existing one.
CREATE UNIQUE INDEX idx_invoices_project_number ON invoices(projectId, number);
