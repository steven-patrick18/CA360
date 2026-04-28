-- Extend RLS to documents.

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "documents"
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
