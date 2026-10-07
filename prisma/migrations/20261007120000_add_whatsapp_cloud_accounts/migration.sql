-- Conta da API oficial do WhatsApp por clínica (aditiva).
CREATE TABLE "whatsapp_cloud_accounts" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "waba_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "display_phone_number" TEXT,
    "access_token" TEXT NOT NULL,
    "coexistence" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_cloud_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_cloud_accounts_clinic_id_key" ON "whatsapp_cloud_accounts"("clinic_id");
CREATE UNIQUE INDEX "whatsapp_cloud_accounts_phone_number_id_key" ON "whatsapp_cloud_accounts"("phone_number_id");
ALTER TABLE "whatsapp_cloud_accounts" ADD CONSTRAINT "whatsapp_cloud_accounts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
