CREATE TABLE "patient_access_logs" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_access_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "patient_access_logs_clinic_id_created_at_idx" ON "patient_access_logs"("clinic_id", "created_at");
CREATE INDEX "patient_access_logs_conversation_id_user_id_created_at_idx" ON "patient_access_logs"("conversation_id", "user_id", "created_at");
