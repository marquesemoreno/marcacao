-- Oferta automática de vaga à lista de espera
ALTER TABLE "clinics" ADD COLUMN "auto_waitlist_offer" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "slot_offers" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "slot_key" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "doctor" TEXT,
    "procedure" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "entry_id" TEXT,
    "phone" TEXT,
    "offered_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "tried_entry_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "slot_offers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "slot_offers_clinic_id_slot_key_key" ON "slot_offers"("clinic_id", "slot_key");
CREATE INDEX "slot_offers_status_expires_at_idx" ON "slot_offers"("status", "expires_at");
