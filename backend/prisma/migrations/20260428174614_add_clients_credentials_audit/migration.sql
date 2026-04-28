-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'HUF', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'COMPANY', 'TRUST', 'AOP_BOI', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Portal" AS ENUM ('INCOME_TAX', 'GST', 'TRACES', 'MCA');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "sr_no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "father_name" TEXT,
    "pan" VARCHAR(10),
    "aadhar_masked" VARCHAR(14),
    "dob" DATE,
    "type_of_assessee" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
    "email" TEXT,
    "mobile" TEXT,
    "address" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "onboarded_on" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_credentials" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "portal" "Portal" NOT NULL,
    "username" TEXT NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_revealed_at" TIMESTAMP(3),
    "last_revealed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_firm_id_idx" ON "clients"("firm_id");

-- CreateIndex
CREATE INDEX "clients_branch_id_idx" ON "clients"("branch_id");

-- CreateIndex
CREATE INDEX "clients_assigned_user_id_idx" ON "clients"("assigned_user_id");

-- CreateIndex
CREATE INDEX "clients_firm_id_status_idx" ON "clients"("firm_id", "status");

-- CreateIndex
CREATE INDEX "clients_firm_id_name_idx" ON "clients"("firm_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "clients_firm_id_sr_no_key" ON "clients"("firm_id", "sr_no");

-- CreateIndex
CREATE UNIQUE INDEX "clients_firm_id_pan_key" ON "clients"("firm_id", "pan");

-- CreateIndex
CREATE INDEX "client_credentials_firm_id_idx" ON "client_credentials"("firm_id");

-- CreateIndex
CREATE INDEX "client_credentials_client_id_idx" ON "client_credentials"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_credentials_client_id_portal_key" ON "client_credentials"("client_id", "portal");

-- CreateIndex
CREATE INDEX "audit_log_firm_id_created_at_idx" ON "audit_log"("firm_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_firm_id_entity_type_entity_id_idx" ON "audit_log"("firm_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "ca_firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "ca_firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_last_revealed_by_fkey" FOREIGN KEY ("last_revealed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "ca_firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
