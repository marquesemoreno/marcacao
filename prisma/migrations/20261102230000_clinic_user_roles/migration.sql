-- Fase 4 da jornada: função do usuário da clínica (RECEPCAO | MARKETING | GESTAO).
-- Quem já era "Gestão" (is_manager) vira GESTAO; os demais, RECEPCAO. is_manager fica
-- (espelhado) para não quebrar nada que ainda leia a coluna.
ALTER TABLE "users" ADD COLUMN "clinic_role" TEXT NOT NULL DEFAULT 'RECEPCAO';
UPDATE "users" SET "clinic_role" = 'GESTAO' WHERE "is_manager" = true;
