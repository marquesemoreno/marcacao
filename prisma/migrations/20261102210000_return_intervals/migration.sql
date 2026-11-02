-- Fase 4 da jornada: intervalo de retorno por médico (código do sistema da clínica) ou por
-- procedimento (clinic_procedures.id). Só tabela nova.
CREATE TABLE "return_intervals" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "return_intervals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "return_intervals_clinic_id_kind_key_key" ON "return_intervals"("clinic_id", "kind", "key");
