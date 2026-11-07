ALTER TABLE "clinics" ADD COLUMN "closing_message_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinics" ADD COLUMN "closing_message_text" TEXT;
