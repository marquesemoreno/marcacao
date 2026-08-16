-- CreateEnum
CREATE TYPE "conversation_status" AS ENUM ('OPEN', 'PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "message_direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cpf" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "assigned_user_id" TEXT,
    "status" "conversation_status" NOT NULL DEFAULT 'OPEN',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" "message_direction" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "message_status" NOT NULL DEFAULT 'PENDING',
    "sender_user_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT,
    "shortcut" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_phone_key" ON "contacts"("phone");

-- CreateIndex
CREATE INDEX "conversations_clinic_id_status_idx" ON "conversations"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "conversations_contact_id_idx" ON "conversations"("contact_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "canned_responses_clinic_id_shortcut_key" ON "canned_responses"("clinic_id", "shortcut");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase Realtime: inclui as duas tabelas na publicação usada pelo
-- Realtime para notificar mudanças (postgres_changes). Sem isso, o
-- cliente Supabase no navegador nunca recebe nada, mesmo com a anon key
-- configurada — ver docs/obsidian/05 - Módulo de Atendimento e Chat Realtime.md.
-- Condicional: a publicação "supabase_realtime" só existe em projetos
-- Supabase de verdade, não no banco "shadow" vazio que o Prisma usa pra
-- validar migrações (nem num Postgres local puro, ex: docker-compose.yml).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages, conversations;
  END IF;
END $$;

-- RLS com "deny by default": habilita Row Level Security sem criar
-- nenhuma policy. Isso bloqueia completamente o acesso via anon/authenticated
-- (as roles que o Supabase client-side usa, inclusive para Realtime, que
-- respeita RLS) — a app continua funcionando normalmente porque o Prisma
-- conecta como o role "postgres" (dono das tabelas, não sujeito a RLS).
-- Sem isso, a anon key (pública, embutida no bundle JS) daria leitura
-- irrestrita a conversas e mensagens de pacientes de qualquer clínica.
-- Ver aviso detalhado em docs/obsidian/05 - Módulo de Atendimento e Chat Realtime.md.
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
