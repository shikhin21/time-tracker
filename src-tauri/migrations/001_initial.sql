CREATE TABLE projects (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  color     TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE entries (
  id        TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects(id),
  date      TEXT NOT NULL,
  hours     REAL NOT NULL CHECK (hours >= 0),
  task      TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX idx_entries_project_date ON entries(projectId, date);

CREATE TABLE rates (
  id            TEXT PRIMARY KEY,
  projectId     TEXT NOT NULL REFERENCES projects(id),
  effectiveDate TEXT NOT NULL,
  rate          REAL NOT NULL CHECK (rate >= 0),
  createdAt     INTEGER NOT NULL,
  updatedAt     INTEGER NOT NULL,
  UNIQUE (projectId, effectiveDate)
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
