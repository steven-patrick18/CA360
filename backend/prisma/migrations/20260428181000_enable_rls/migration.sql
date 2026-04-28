-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) — defense-in-depth at the database layer.
-- ─────────────────────────────────────────────────────────────────────────
--
-- Policy semantics:
--   - When the GUC `app.current_firm_id` is set, only rows whose `firm_id`
--     matches the GUC value are visible/mutable.
--   - When the GUC is NULL or empty (e.g. during seed and migrations), all
--     rows are accessible. The application sets the GUC after JWT verify
--     so per-request queries are scoped to the caller's firm.
--
-- This is *additive* defense — the app layer ALSO filters by firm_id in
-- every query. RLS catches mistakes / SQL injection that the app layer
-- might miss.
--
-- Hardening for production (TODO):
--   1. Run migrations as a separate Postgres user with BYPASSRLS.
--   2. Switch the application user to one *without* BYPASSRLS so the GUC
--      check is mandatory, not permissive.
-- ─────────────────────────────────────────────────────────────────────────

-- Helper: a single boolean expression we use everywhere
--   "row_firm_id matches the current GUC, OR the GUC isn't set"
-- We inline it because PG planner inlines stable functions just fine,
-- and a function would add a (small) maintenance burden.

-- ── ca_firm ────────────────────────────────────────────────────────────
ALTER TABLE "ca_firm" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_self_isolation" ON "ca_firm"
  USING (
    current_setting('app.current_firm_id', true) IS NULL
    OR current_setting('app.current_firm_id', true) = ''
    OR id = current_setting('app.current_firm_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.current_firm_id', true) IS NULL
    OR current_setting('app.current_firm_id', true) = ''
    OR id = current_setting('app.current_firm_id', true)::uuid
  );

-- ── branches ───────────────────────────────────────────────────────────
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "branches"
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

-- ── users ──────────────────────────────────────────────────────────────
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "users"
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

-- ── clients ────────────────────────────────────────────────────────────
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "clients"
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

-- ── client_credentials ─────────────────────────────────────────────────
ALTER TABLE "client_credentials" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "client_credentials"
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

-- ── audit_log ──────────────────────────────────────────────────────────
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "audit_log"
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
