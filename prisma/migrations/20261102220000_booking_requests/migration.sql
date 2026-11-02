-- Fase 4 da jornada: pedidos de marcação extraídos da conversa (pré-agendamento). Só tabela nova.
CREATE TABLE "booking_requests" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "phone" TEXT,
    "patient_name" TEXT,
    "doctor_name" TEXT,
    "procedure" TEXT,
    "period" TEXT NOT NULL DEFAULT 'ANY',
    "preferred_dates" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "handled_by_user_id" TEXT,
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "booking_requests_clinic_id_status_idx" ON "booking_requests"("clinic_id", "status");
CREATE INDEX "booking_requests_conversation_id_idx" ON "booking_requests"("conversation_id");
