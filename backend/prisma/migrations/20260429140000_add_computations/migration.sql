-- Tax computations module: per-client tax calculator records. Inputs and
-- computed snapshot are stored as JSONB so slab logic can evolve without
-- schema changes year-over-year.

CREATE TYPE "TaxRegime" AS ENUM ('OLD', 'NEW');

CREATE TYPE "AgeCategory" AS ENUM ('BELOW_60', 'SENIOR_60_TO_79', 'SUPER_SENIOR_80_PLUS');

CREATE TABLE "computations" (
    "id"              UUID NOT NULL,
    "firm_id"         UUID NOT NULL,
    "client_id"       UUID NOT NULL,
    "assessment_year" VARCHAR(7) NOT NULL,
    "regime"          "TaxRegime" NOT NULL,
    "age_category"    "AgeCategory" NOT NULL DEFAULT 'BELOW_60',
    "inputs"          JSONB NOT NULL,
    "computed"        JSONB NOT NULL,
    "tax_payable"     DECIMAL(15,2),
    "remarks"         TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "computations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "computations_firm_id_idx" ON "computations"("firm_id");
CREATE INDEX "computations_client_id_idx" ON "computations"("client_id");
CREATE INDEX "computations_firm_id_assessment_year_idx" ON "computations"("firm_id", "assessment_year");

ALTER TABLE "computations"
  ADD CONSTRAINT "computations_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "ca_firm"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "computations"
  ADD CONSTRAINT "computations_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security: same firm-isolation pattern as every other table.
ALTER TABLE "computations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "computations"
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
