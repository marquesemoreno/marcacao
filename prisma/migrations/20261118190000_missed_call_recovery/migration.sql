-- Recuperação de ligação perdida pelo WhatsApp (src/lib/missed-call.ts). Só acrescenta.
ALTER TABLE "clinics" ADD COLUMN "missed_call_recovery_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "phone_calls" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "call_id" TEXT NOT NULL,
    "phone" TEXT,
    "trusted_number" BOOLEAN NOT NULL DEFAULT true,
    "is_video" BOOLEAN NOT NULL DEFAULT false,
    "events" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'PENDING',
    "recovery_status" TEXT NOT NULL DEFAULT 'PENDING',
    "recovery_reason" TEXT,
    "recovered_at" TIMESTAMP(3),
    "task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "phone_calls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "phone_calls_clinic_id_call_id_key" ON "phone_calls"("clinic_id", "call_id");
CREATE INDEX "phone_calls_recovery_status_started_at_idx" ON "phone_calls"("recovery_status", "started_at");
CREATE INDEX "phone_calls_clinic_id_phone_recovered_at_idx" ON "phone_calls"("clinic_id", "phone", "recovered_at");

ALTER TABLE "phone_calls" ADD CONSTRAINT "phone_calls_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mesma trava das outras tabelas: sem acesso pela API pública do Supabase.
ALTER TABLE "phone_calls" ENABLE ROW LEVEL SECURITY;
