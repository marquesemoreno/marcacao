ALTER TABLE "clinics" ADD COLUMN "urgency_tag_enabled" BOOLEAN NOT NULL DEFAULT false;
-- Desligado por padrão: tira a etiqueta das conversas que já tinham.
UPDATE "conversations" SET "tags" = array_remove("tags", '🚨 Urgência Clínica') WHERE '🚨 Urgência Clínica' = ANY("tags");
