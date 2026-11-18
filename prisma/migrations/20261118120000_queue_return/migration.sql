-- Conversa atribuída sem resposta volta para a fila (src/lib/queue-return.ts).
ALTER TABLE "conversations" ADD COLUMN "assigned_at" TIMESTAMP(3);
ALTER TABLE "clinics" ADD COLUMN "unanswered_return_minutes" INTEGER;
