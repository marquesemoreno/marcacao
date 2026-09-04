-- CreateTable
CREATE TABLE "bridge_reminder_logs" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "bridge_numero" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bridge_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bridge_reminder_logs_clinic_id_bridge_numero_key" ON "bridge_reminder_logs"("clinic_id", "bridge_numero");

-- AddForeignKey
ALTER TABLE "bridge_reminder_logs" ADD CONSTRAINT "bridge_reminder_logs_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
