-- Consultórios e salas de exame para o Relatório › Ocupação.
CREATE TABLE "clinic_rooms" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CONSULTORIO',
    "hours" JSONB NOT NULL DEFAULT '[]',
    "procedure_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slot_minutes" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clinic_rooms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "clinic_rooms_clinic_id_idx" ON "clinic_rooms"("clinic_id");
-- Mesma trava das outras tabelas: acesso só pelo servidor (RLS ligado, sem política).
ALTER TABLE "clinic_rooms" ENABLE ROW LEVEL SECURITY;
