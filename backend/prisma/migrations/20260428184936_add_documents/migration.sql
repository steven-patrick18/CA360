-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "filing_id" UUID,
    "category" VARCHAR(60),
    "storage_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_firm_id_idx" ON "documents"("firm_id");

-- CreateIndex
CREATE INDEX "documents_client_id_idx" ON "documents"("client_id");

-- CreateIndex
CREATE INDEX "documents_filing_id_idx" ON "documents"("filing_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "ca_firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_filing_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "itr_filings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
