-- Extend RLS to itr_filings (added in the previous migration).

ALTER TABLE "itr_filings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "itr_filings"
  USING (
    current_setting('app.current_firm_id', true) IS NULL
    OR current_setting('app.current_firm_id', true) = ''
    OR firm_id = current_setting('app.current_firm_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.current_firm_id', true) IS NULL
    OR current_setting('app.current_firm_id', true) = ''
    OR firm_id = current_setting('app.current_firm_id', true)::uuid
  );
