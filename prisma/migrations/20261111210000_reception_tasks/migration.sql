-- Lista de tarefas da recepção (/clinic/tarefas). Só cria uma tabela nova; não mexe em
-- tabela nem dado existente. IF NOT EXISTS: rodar de novo não dá erro.

CREATE TABLE IF NOT EXISTS "reception_tasks" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "text" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "assigned_user_id" TEXT,
    "done_at" TIMESTAMP(3),
    "done_by_user_id" TEXT,
    "created_by_user_id" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reception_tasks_clinic_id_done_at_idx" ON "reception_tasks"("clinic_id", "done_at");
CREATE INDEX IF NOT EXISTS "reception_tasks_conversation_id_idx" ON "reception_tasks"("conversation_id");

DO $$ BEGIN
  ALTER TABLE "reception_tasks" ADD CONSTRAINT "reception_tasks_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Apagar a conversa (exclusão do titular, LGPD) apaga as tarefas dela.
DO $$ BEGIN
  ALTER TABLE "reception_tasks" ADD CONSTRAINT "reception_tasks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mesmo padrão das outras tabelas: sem acesso pela API pública do Supabase.
ALTER TABLE "reception_tasks" ENABLE ROW LEVEL SECURITY;
