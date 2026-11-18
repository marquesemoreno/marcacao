-- Gestão pode liberar uma campanha para quem não deu consentimento de marketing.
ALTER TABLE "broadcast_campaigns" ADD COLUMN "consent_override_at" TIMESTAMP(3);
ALTER TABLE "broadcast_campaigns" ADD COLUMN "consent_override_by_user_id" TEXT;
