CREATE TABLE IF NOT EXISTS "EMPSource" (
  id           TEXT PRIMARY KEY,
  "trackId"    TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  source_type  TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  source_name  TEXT,
  "importedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("trackId", platform, source_id)
);

ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "inEmp" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_track_emp ON "Track"("inEmp") WHERE "inEmp" = TRUE;

CREATE OR REPLACE FUNCTION sync_track_in_emp() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE "Track" SET "inEmp" = FALSE
    WHERE id = OLD."trackId"
      AND NOT EXISTS (
        SELECT 1 FROM "EMPSource" WHERE "trackId" = OLD."trackId"
      );
    RETURN OLD;
  END IF;
  UPDATE "Track" SET "inEmp" = TRUE WHERE id = NEW."trackId";
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emp_source_inserted ON "EMPSource";
CREATE TRIGGER trg_emp_source_inserted
  AFTER INSERT OR DELETE ON "EMPSource"
  FOR EACH ROW EXECUTE FUNCTION sync_track_in_emp();

CREATE TABLE IF NOT EXISTS "IngestionRun" (
  id            TEXT PRIMARY KEY,
  "startedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finishedAt"  TIMESTAMPTZ,
  status        TEXT NOT NULL,
  platform      TEXT,
  stages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  "triggeredBy" TEXT NOT NULL DEFAULT 'scheduler'
);
CREATE INDEX IF NOT EXISTS idx_ingestion_started ON "IngestionRun"("startedAt" DESC);
