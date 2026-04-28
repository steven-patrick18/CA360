-- Add structured Computation of Income (`details`) and the raw uploaded JSON
-- (`source_json` + original filename) to itr_filings, so the imported return
-- can be displayed as a CA-style sheet and the original file re-downloaded.

ALTER TABLE "itr_filings"
  ADD COLUMN "details" JSONB,
  ADD COLUMN "source_json" TEXT,
  ADD COLUMN "source_filename" TEXT;

-- Backfill: any filing that already has a filed_date but is still marked
-- IN_PROCESS was imported before the status-on-import fix. A filing with a
-- filed date is, by definition, filed.
UPDATE "itr_filings"
   SET "status" = 'FILED'
 WHERE "filed_date" IS NOT NULL
   AND "status" = 'IN_PROCESS';
