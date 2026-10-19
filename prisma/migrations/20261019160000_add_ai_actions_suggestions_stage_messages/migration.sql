-- CreateTable
CREATE TABLE "ai_action_logs" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_data_suggestions" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "cpf" TEXT,
    "convenio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_data_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_messages" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_action_logs_clinic_id_created_at_idx" ON "ai_action_logs"("clinic_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "patient_data_suggestions_conversation_id_key" ON "patient_data_suggestions"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_messages_clinic_id_stage_key" ON "stage_messages"("clinic_id", "stage");
