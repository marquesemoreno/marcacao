-- Automações com vários passos (toque, segundo toque, finalizar). Só acrescenta duas colunas
-- com valor padrão nas tabelas das automações. IF NOT EXISTS: pode rodar de novo.

ALTER TABLE "tag_automations" ADD COLUMN IF NOT EXISTS "extra_steps" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "tag_automation_enrollments" ADD COLUMN IF NOT EXISTS "step_index" INTEGER NOT NULL DEFAULT 0;
