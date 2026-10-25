-- Disparos por SMS e e-mail: canal da campanha, assunto do e-mail e consentimento por canal.
-- Tudo aditivo: campanhas existentes ficam WHATSAPP e nada muda para elas.
CREATE TYPE "broadcast_channel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

ALTER TABLE "broadcast_campaigns" ADD COLUMN "channel" "broadcast_channel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "broadcast_campaigns" ADD COLUMN "subject" TEXT;

CREATE TABLE "channel_consents" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "channel" "broadcast_channel" NOT NULL,
    "address" TEXT NOT NULL,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_consents_clinic_id_channel_address_key" ON "channel_consents"("clinic_id", "channel", "address");

ALTER TABLE "channel_consents" ADD CONSTRAINT "channel_consents_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
