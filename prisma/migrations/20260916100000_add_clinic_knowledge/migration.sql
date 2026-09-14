CREATE TYPE "clinic_knowledge_category" AS ENUM ('CORPO_CLINICO', 'HORARIO_ATENDIMENTO', 'CONVENIOS', 'VALORES', 'REGRAS_RETORNO', 'PREPARO_EXAME', 'OUTRO');

CREATE TABLE "clinic_knowledge_entries" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "category" "clinic_knowledge_category" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_knowledge_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clinic_knowledge_entries_clinic_id_active_idx" ON "clinic_knowledge_entries"("clinic_id", "active");

ALTER TABLE "clinic_knowledge_entries" ADD CONSTRAINT "clinic_knowledge_entries_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clinic_knowledge_entries" ENABLE ROW LEVEL SECURITY;
