-- Convênios aceitos por clínica + resposta automática (Ações da IA). Só cria uma tabela nova;
-- não mexe em tabela nem dado existente. IF NOT EXISTS: rodar de novo não dá erro.

CREATE TABLE IF NOT EXISTS "clinic_insurance_settings" (
    "clinic_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "accepted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_insurance_settings_pkey" PRIMARY KEY ("clinic_id")
);

DO $$ BEGIN
  ALTER TABLE "clinic_insurance_settings" ADD CONSTRAINT "clinic_insurance_settings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mesmo padrão das outras tabelas: sem acesso pela API pública do Supabase.
ALTER TABLE "clinic_insurance_settings" ENABLE ROW LEVEL SECURITY;
