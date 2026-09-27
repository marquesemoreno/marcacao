ALTER TABLE "clinics" ADD COLUMN "default_ticket" DECIMAL(10,2);
ALTER TABLE "conversations" ADD COLUMN "acquisition_channel" TEXT;
ALTER TABLE "conversations" ADD COLUMN "acquisition_detail" TEXT;
ALTER TABLE "conversations" ADD COLUMN "acquisition_ad_id" TEXT;
ALTER TABLE "bridge_reminder_logs" ADD COLUMN "phone" TEXT;
ALTER TABLE "bridge_reminder_logs" ADD COLUMN "response" TEXT;
ALTER TABLE "bridge_reminder_logs" ADD COLUMN "responded_at" TIMESTAMP(3);

CREATE TABLE "acquisition_rules" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acquisition_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acquisition_rules_clinic_id_idx" ON "acquisition_rules"("clinic_id");
ALTER TABLE "acquisition_rules" ADD CONSTRAINT "acquisition_rules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "bridge_reminder_logs_clinic_id_phone_idx" ON "bridge_reminder_logs"("clinic_id", "phone");
