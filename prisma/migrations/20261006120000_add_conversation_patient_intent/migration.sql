-- Intenção do paciente classificada pelo Jev (aditiva).
ALTER TABLE "conversations" ADD COLUMN "patient_intent" TEXT;
ALTER TABLE "conversations" ADD COLUMN "patient_intent_confidence" DOUBLE PRECISION;
ALTER TABLE "conversations" ADD COLUMN "patient_intent_at" TIMESTAMP(3);
