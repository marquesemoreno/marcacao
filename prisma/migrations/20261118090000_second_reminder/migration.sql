-- 2º lembrete no dia da consulta só para quem não respondeu ao D-1 (src/lib/second-reminder.ts).
ALTER TABLE "hospital_integrations" ADD COLUMN "second_reminder_hours" INTEGER;
ALTER TABLE "bridge_reminder_logs" ADD COLUMN "second_sent_at" TIMESTAMP(3);
