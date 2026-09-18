-- CreateEnum
CREATE TYPE "msp_lead_status" AS ENUM ('NEW', 'CONTACTED', 'REPLIED', 'NOT_INTERESTED');

-- CreateTable
CREATE TABLE "msp_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT,
    "city" TEXT DEFAULT 'Vitória da Conquista',
    "channel" TEXT,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "status" "msp_lead_status" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "msp_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "msp_outreach_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "msp_outreach_state_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "msp_leads" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "msp_outreach_state" ENABLE ROW LEVEL SECURITY;
