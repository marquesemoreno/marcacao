-- Atestado de anonimização (LGPD): IP de quem executou e código de autenticidade.
ALTER TABLE "data_deletion_records" ADD COLUMN "performed_from_ip" TEXT;
ALTER TABLE "data_deletion_records" ADD COLUMN "certificate_code" TEXT;
CREATE UNIQUE INDEX "data_deletion_records_certificate_code_key" ON "data_deletion_records"("certificate_code");
