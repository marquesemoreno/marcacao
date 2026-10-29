-- Status de entrega do e-mail (webhook do Resend). Só aditiva.
ALTER TABLE "broadcast_recipients" ADD COLUMN "provider_message_id" TEXT;
ALTER TABLE "broadcast_recipients" ADD COLUMN "delivery_status" TEXT;
ALTER TABLE "broadcast_recipients" ADD COLUMN "delivery_at" TIMESTAMP(3);
CREATE INDEX "broadcast_recipients_provider_message_id_idx" ON "broadcast_recipients"("provider_message_id");
