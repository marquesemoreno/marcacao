-- CreateTable
CREATE TABLE "hospital_integrations" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "api_url" TEXT NOT NULL,
    "api_token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_checked_at" TIMESTAMP(3),
    "last_check_ok" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospital_integrations_clinic_id_key" ON "hospital_integrations"("clinic_id");

-- AddForeignKey
ALTER TABLE "hospital_integrations" ADD CONSTRAINT "hospital_integrations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
