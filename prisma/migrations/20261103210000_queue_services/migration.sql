-- Senhas por serviço (Consulta, Exame, Resultado…)
CREATE TABLE "queue_services" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "queue_services_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "queue_services_clinic_id_letter_key" ON "queue_services"("clinic_id", "letter");

ALTER TABLE "queue_tickets" ADD COLUMN "series" TEXT NOT NULL DEFAULT '';
ALTER TABLE "queue_tickets" ADD COLUMN "service_id" TEXT;
ALTER TABLE "queue_tickets" ADD COLUMN "service_name" TEXT;
UPDATE "queue_tickets" SET "series" = "type" WHERE "series" = '';
DROP INDEX "queue_tickets_clinic_id_day_type_number_key";
CREATE UNIQUE INDEX "queue_tickets_clinic_id_day_series_number_key" ON "queue_tickets"("clinic_id", "day", "series", "number");
