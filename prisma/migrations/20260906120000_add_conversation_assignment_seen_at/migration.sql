-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "assignment_seen_at" TIMESTAMP(3);

-- Backfill: conversas já existentes não devem nascer marcadas como "não vistas" —
-- senão toda conversa hoje atribuída a alguém dispararia selo/notificação de uma vez.
UPDATE "conversations" SET "assignment_seen_at" = CURRENT_TIMESTAMP;
