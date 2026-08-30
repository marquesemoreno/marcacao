-- CreateEnum
CREATE TYPE "ai_consent_status" AS ENUM ('NOT_ASKED', 'PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "ai_consent_status" "ai_consent_status" NOT NULL DEFAULT 'NOT_ASKED',
ADD COLUMN     "ai_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ai_attendant_configs" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_attendant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interaction_logs" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_message" TEXT NOT NULL,
    "ai_response" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_attendant_configs_clinic_id_key" ON "ai_attendant_configs"("clinic_id");

-- CreateIndex
CREATE INDEX "ai_interaction_logs_conversation_id_idx" ON "ai_interaction_logs"("conversation_id");

-- AddForeignKey
ALTER TABLE "ai_attendant_configs" ADD CONSTRAINT "ai_attendant_configs_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction_logs" ADD CONSTRAINT "ai_interaction_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
