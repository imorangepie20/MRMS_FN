CREATE TABLE IF NOT EXISTS "Setting" (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
