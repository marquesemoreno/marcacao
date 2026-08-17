-- CreateEnum
CREATE TYPE "conversation_channel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'WEBCHAT');

-- CreateEnum
CREATE TYPE "conversation_department" AS ENUM ('RECEPCAO', 'AGENDAMENTO', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "conversation_funnel_stage" AS ENUM ('NOVOS', 'TRIAGEM', 'ORCAMENTO', 'AGENDADO');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('TEXT', 'AUDIO', 'INTERNAL_NOTE', 'ATTACHMENT');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "channel" "conversation_channel" NOT NULL DEFAULT 'WHATSAPP',
ADD COLUMN     "department" "conversation_department" NOT NULL DEFAULT 'RECEPCAO',
ADD COLUMN     "estimated_value" DECIMAL(10,2),
ADD COLUMN     "funnel_stage" "conversation_funnel_stage" NOT NULL DEFAULT 'NOVOS';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachment_name" TEXT,
ADD COLUMN     "attachment_size" TEXT,
ADD COLUMN     "audio_duration" TEXT,
ADD COLUMN     "type" "message_type" NOT NULL DEFAULT 'TEXT';
