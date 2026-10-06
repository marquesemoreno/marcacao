-- Pausa dos lembretes D-1 por clínica (aditiva).
ALTER TABLE "hospital_integrations" ADD COLUMN "reminders_paused_until" TIMESTAMP(3);
