ALTER TABLE entries ADD COLUMN loggedAt INTEGER NOT NULL DEFAULT 0;
UPDATE entries SET loggedAt = createdAt WHERE loggedAt = 0;
