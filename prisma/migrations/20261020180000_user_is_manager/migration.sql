ALTER TABLE "users" ADD COLUMN "is_manager" BOOLEAN NOT NULL DEFAULT false;
-- Ninguém perde acesso no dia da mudança: todo usuário de clínica atual começa como gestão;
-- o admin desliga quem é só recepção.
UPDATE "users" SET "is_manager" = true WHERE "role" = 'CLINIC';
