-- Fase 4 da jornada do paciente: respostas da pesquisa de satisfação (NPS). Só tabela nova.
CREATE TABLE "nps_responses" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "token_id" TEXT,
    "phone" TEXT,
    "score" INTEGER NOT NULL,
    "comment_encrypted" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nps_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nps_responses_token_id_key" ON "nps_responses"("token_id");
CREATE INDEX "nps_responses_clinic_id_submitted_at_idx" ON "nps_responses"("clinic_id", "submitted_at");
