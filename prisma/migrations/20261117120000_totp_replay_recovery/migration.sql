-- Auditoria de segurança 16/11/2026, B3: código do 2FA não vale duas vezes + códigos de reserva.
-- Só acrescenta colunas (sem tabela nova, sem RLS a ligar). Aplicar ANTES do deploy do código.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_last_step" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_recovery_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
