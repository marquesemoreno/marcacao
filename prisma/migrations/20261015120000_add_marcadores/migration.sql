CREATE TABLE "marcadores" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marcadores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "marcadores_clinic_id_code_key" ON "marcadores"("clinic_id", "code");
CREATE UNIQUE INDEX "marcadores_clinic_id_phone_key" ON "marcadores"("clinic_id", "phone");
ALTER TABLE "conversations" ADD COLUMN "marcador_id" TEXT;
CREATE INDEX "conversations_marcador_id_idx" ON "conversations"("marcador_id");
ALTER TABLE "agenda_marks" ADD COLUMN "phone" TEXT;
