CREATE TABLE "campaign_spends" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_spends_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "campaign_spends_clinic_id_campaign_month_key" ON "campaign_spends"("clinic_id", "campaign", "month");
ALTER TABLE "campaign_spends" ADD CONSTRAINT "campaign_spends_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
