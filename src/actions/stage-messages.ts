"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { STAGE_MESSAGE_STAGES, normalizeStageMessageTemplate, stageMessageText, type StageMessageStage } from "@/lib/stage-messages";

/** Modelos cadastrados pela clínica, por etapa (vazio = sem mensagem nessa etapa). */
export async function listStageMessages(): Promise<Record<StageMessageStage, string>> {
  const { clinicId } = await requireClinicSession();
  const rows = await prisma.stageMessage.findMany({ where: { clinicId } });
  const out = Object.fromEntries(STAGE_MESSAGE_STAGES.map((s) => [s, ""])) as Record<StageMessageStage, string>;
  for (const r of rows) if ((STAGE_MESSAGE_STAGES as readonly string[]).includes(r.stage)) out[r.stage as StageMessageStage] = r.text;
  return out;
}

export async function saveStageMessage(stage: string, rawText: string) {
  const { clinicId } = await requireClinicSession();
  const parsed = normalizeStageMessageTemplate(stage, rawText);
  if (!parsed.ok) throw new Error(parsed.error);
  if (!parsed.text) {
    await prisma.stageMessage.deleteMany({ where: { clinicId, stage: parsed.stage } });
  } else {
    await prisma.stageMessage.upsert({
      where: { clinicId_stage: { clinicId, stage: parsed.stage } },
      create: { clinicId, stage: parsed.stage, text: parsed.text },
      update: { text: parsed.text },
    });
  }
  return listStageMessages();
}

/** Texto da etapa já com nome, médico e clínica deste paciente, para a recepção revisar. */
export async function getStageMessageDraft(conversationId: string, stage: string) {
  const { clinicId } = await requireClinicSession();
  const parsed = normalizeStageMessageTemplate(stage, "");
  if (!parsed.ok) return null;
  const [conversation, template, clinic] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { clinicId: true, channel: true, contact: { select: { name: true, preferredDoctor: true } } },
    }),
    prisma.stageMessage.findUnique({ where: { clinicId_stage: { clinicId, stage: parsed.stage } } }),
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { tradeName: true } }),
  ]);
  if (!conversation || conversation.clinicId !== clinicId) throw new Error("Conversa não encontrada");
  return stageMessageText(template?.text, {
    nome: conversation.contact.name,
    medico: conversation.contact.preferredDoctor,
    clinica: clinic?.tradeName,
  });
}
