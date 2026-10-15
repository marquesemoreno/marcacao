ALTER TABLE "whatsapp_cloud_accounts" ADD COLUMN "verified_name" TEXT;
ALTER TABLE "whatsapp_cloud_accounts" ADD COLUMN "two_step_pin" TEXT;
CREATE TABLE "cloud_test_messages" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "template_name" TEXT,
    "wamid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cloud_test_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cloud_test_messages_wamid_key" ON "cloud_test_messages"("wamid");
CREATE INDEX "cloud_test_messages_clinic_id_created_at_idx" ON "cloud_test_messages"("clinic_id", "created_at");
