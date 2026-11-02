-- Fase 1 da jornada do paciente: links do paciente, ficha prévia, termos versionados e
-- auditoria. Só cria tabelas novas — não altera nenhuma tabela existente.
CREATE TABLE "patient_tokens" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "phone" TEXT,
    "contact_id" TEXT,
    "appointment_source" TEXT,
    "appointment_external_id" TEXT,
    "appointment_date" DATE,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "patient_tokens_token_hash_key" ON "patient_tokens"("token_hash");
CREATE INDEX "patient_tokens_clinic_id_kind_appointment_date_idx" ON "patient_tokens"("clinic_id", "kind", "appointment_date");
CREATE INDEX "patient_tokens_expires_at_idx" ON "patient_tokens"("expires_at");

CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ANAMNESE',
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "form_templates_clinic_id_kind_version_key" ON "form_templates"("clinic_id", "kind", "version");

CREATE TABLE "patient_form_responses" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "token_id" TEXT,
    "phone" TEXT,
    "contact_id" TEXT,
    "appointment_source" TEXT,
    "appointment_external_id" TEXT,
    "appointment_date" DATE,
    "answers_encrypted" TEXT NOT NULL,
    "consent_acceptance_id" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_form_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "patient_form_responses_token_id_key" ON "patient_form_responses"("token_id");
CREATE INDEX "patient_form_responses_clinic_id_appointment_date_idx" ON "patient_form_responses"("clinic_id", "appointment_date");
CREATE INDEX "patient_form_responses_clinic_id_phone_idx" ON "patient_form_responses"("clinic_id", "phone");
ALTER TABLE "patient_form_responses" ADD CONSTRAINT "patient_form_responses_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "consent_terms" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_terms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consent_terms_clinic_id_kind_version_idx" ON "consent_terms"("clinic_id", "kind", "version");

CREATE TABLE "consent_acceptances" (
    "id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "phone" TEXT,
    "contact_id" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_acceptances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consent_acceptances_clinic_id_phone_idx" ON "consent_acceptances"("clinic_id", "phone");
ALTER TABLE "consent_acceptances" ADD CONSTRAINT "consent_acceptances_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "consent_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_clinic_id_created_at_idx" ON "audit_logs"("clinic_id", "created_at");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");
