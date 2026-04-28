-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('PENDING', 'DOCS_AWAITED', 'IN_PROCESS', 'READY', 'FILED', 'ACKNOWLEDGED', 'DEFECTIVE');

-- CreateEnum
CREATE TYPE "ItrForm" AS ENUM ('ITR1', 'ITR2', 'ITR3', 'ITR4', 'ITR5', 'ITR6', 'ITR7');

-- CreateTable
CREATE TABLE "itr_filings" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "assessment_year" VARCHAR(7) NOT NULL,
    "itr_form" "ItrForm",
    "status" "FilingStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" DATE,
    "filed_date" DATE,
    "acknowledgement_no" TEXT,
    "gross_income" DECIMAL(15,2),
    "tax_paid" DECIMAL(15,2),
    "refund_amount" DECIMAL(15,2),
    "prepared_by" UUID,
    "filed_by" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itr_filings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itr_filings_firm_id_idx" ON "itr_filings"("firm_id");

-- CreateIndex
CREATE INDEX "itr_filings_client_id_idx" ON "itr_filings"("client_id");

-- CreateIndex
CREATE INDEX "itr_filings_firm_id_status_idx" ON "itr_filings"("firm_id", "status");

-- CreateIndex
CREATE INDEX "itr_filings_firm_id_assessment_year_idx" ON "itr_filings"("firm_id", "assessment_year");

-- CreateIndex
CREATE INDEX "itr_filings_firm_id_due_date_idx" ON "itr_filings"("firm_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "itr_filings_client_id_assessment_year_key" ON "itr_filings"("client_id", "assessment_year");

-- AddForeignKey
ALTER TABLE "itr_filings" ADD CONSTRAINT "itr_filings_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "ca_firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itr_filings" ADD CONSTRAINT "itr_filings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itr_filings" ADD CONSTRAINT "itr_filings_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itr_filings" ADD CONSTRAINT "itr_filings_filed_by_fkey" FOREIGN KEY ("filed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
