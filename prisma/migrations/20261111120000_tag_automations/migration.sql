-- Automações por tag (Disparos › Automações). Só cria duas tabelas novas; não mexe em
-- tabela nem dado existente. IF NOT EXISTS: rodar de novo não dá erro.

CREATE TABLE IF NOT EXISTS "tag_automations" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "delay_hours" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'REVIEW',
    "reminder_text" TEXT,
    "cloud_template_name" TEXT,
    "cloud_template_language" TEXT,
    "cloud_template_body" TEXT,
    "cloud_template_params" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_automations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tag_automation_enrollments" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMP(3) NOT NULL,
    "done_at" TIMESTAMP(3),
    "campaign_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_automation_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tag_automations_clinic_id_idx" ON "tag_automations"("clinic_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tag_automation_enrollments_automation_id_conversation_id_key" ON "tag_automation_enrollments"("automation_id", "conversation_id");
CREATE INDEX IF NOT EXISTS "tag_automation_enrollments_status_due_at_idx" ON "tag_automation_enrollments"("status", "due_at");

DO $$ BEGIN
  ALTER TABLE "tag_automations" ADD CONSTRAINT "tag_automations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tag_automation_enrollments" ADD CONSTRAINT "tag_automation_enrollments_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "tag_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mesmo padrão das outras tabelas: sem acesso pela API pública do Supabase (o sistema usa o Prisma).
ALTER TABLE "tag_automations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tag_automation_enrollments" ENABLE ROW LEVEL SECURITY;
