-- Totem de senhas
ALTER TABLE "tv_displays" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TV';
ALTER TABLE "patient_calls" ADD COLUMN "ticket_code" TEXT;

CREATE TABLE "queue_tickets" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "follow_token_hash" TEXT NOT NULL,
    "patient_name" TEXT,
    "phone" TEXT,
    "doctor" TEXT,
    "appointment_source" TEXT,
    "appointment_external_id" TEXT,
    "appointment_time" TEXT,
    "room" TEXT,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "called_at" TIMESTAMP(3),
    "called_by_user_id" TEXT,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "queue_tickets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "queue_tickets_follow_token_hash_key" ON "queue_tickets"("follow_token_hash");
CREATE UNIQUE INDEX "queue_tickets_clinic_id_day_type_number_key" ON "queue_tickets"("clinic_id", "day", "type", "number");
CREATE INDEX "queue_tickets_clinic_id_day_status_idx" ON "queue_tickets"("clinic_id", "day", "status");
