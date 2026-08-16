-- CreateEnum
CREATE TYPE "partner_lead_status" AS ENUM ('NEW', 'CONTACTED', 'PARTNER', 'REJECTED');

-- CreateTable
CREATE TABLE "partner_leads" (
    "id" TEXT NOT NULL,
    "clinic_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "specialties" TEXT NOT NULL,
    "notes" TEXT,
    "status" "partner_lead_status" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_leads_pkey" PRIMARY KEY ("id")
);
