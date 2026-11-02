-- Régua automática (pós-consulta, retorno, reativação). Só adiciona.
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days_after" INTEGER NOT NULL,
    "require_no_future" BOOLEAN NOT NULL DEFAULT true,
    "message_template" TEXT NOT NULL,
    "cloud_template_name" TEXT,
    "cloud_template_language" TEXT,
    "cloud_template_body" TEXT,
    "cloud_template_params" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT false,
    "last_run_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "automation_rules_clinic_id_kind_key" ON "automation_rules"("clinic_id", "kind");
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "broadcast_campaigns" ADD COLUMN "automation_rule_id" TEXT;
CREATE INDEX "broadcast_campaigns_automation_rule_id_idx" ON "broadcast_campaigns"("automation_rule_id");
