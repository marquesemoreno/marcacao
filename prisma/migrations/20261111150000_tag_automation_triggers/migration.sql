-- Automações: gatilho por etapa do CRM, espera contada da última mensagem ("parado há N")
-- e parar quando o paciente responde. Só acrescenta colunas com valor padrão em
-- tag_automations (tabela nova, usada só pelas automações). IF NOT EXISTS: pode rodar de novo.

ALTER TABLE "tag_automations" ADD COLUMN IF NOT EXISTS "trigger_kind" TEXT NOT NULL DEFAULT 'TAG';
ALTER TABLE "tag_automations" ADD COLUMN IF NOT EXISTS "stage" TEXT;
ALTER TABLE "tag_automations" ADD COLUMN IF NOT EXISTS "wait_from" TEXT NOT NULL DEFAULT 'ENTRY';
ALTER TABLE "tag_automations" ADD COLUMN IF NOT EXISTS "stop_on_reply" BOOLEAN NOT NULL DEFAULT false;
