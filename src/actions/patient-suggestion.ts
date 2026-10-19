"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";

async function ownedConversation(conversationId: string, clinicId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true, contactId: true, contact: { select: { cpf: true, convenio: true } } },
  });
  if (!conversation || conversation.clinicId !== clinicId) throw new Error("Conversa não encontrada");
  return conversation;
}

/** CPF/convênio achados nas mensagens do paciente que ainda não estão no cadastro. */
export async function getPatientSuggestion(conversationId: string) {
  const { clinicId } = await requireClinicSession();
  const conversation = await ownedConversation(conversationId, clinicId);
  const suggestion = await prisma.patientDataSuggestion.findUnique({ where: { conversationId } });
  if (!suggestion) return null;
  const cpf = suggestion.cpf && !conversation.contact.cpf ? suggestion.cpf : null;
  const convenio = suggestion.convenio && !conversation.contact.convenio ? suggestion.convenio : null;
  return cpf || convenio ? { cpf, convenio } : null;
}

/** Aplica a sugestão no cadastro — só campos que ainda estão vazios. */
export async function applyPatientSuggestion(conversationId: string) {
  const { clinicId } = await requireClinicSession();
  const conversation = await ownedConversation(conversationId, clinicId);
  const suggestion = await prisma.patientDataSuggestion.findUnique({ where: { conversationId } });
  if (suggestion) {
    const data = {
      ...(suggestion.cpf && !conversation.contact.cpf ? { cpf: suggestion.cpf } : {}),
      ...(suggestion.convenio && !conversation.contact.convenio ? { convenio: suggestion.convenio } : {}),
    };
    if (Object.keys(data).length > 0) await prisma.contact.update({ where: { id: conversation.contactId }, data });
    await prisma.patientDataSuggestion.delete({ where: { conversationId } });
  }
  revalidatePath("/clinic/inbox");
  revalidatePath("/clinic/contatos");
}

export async function dismissPatientSuggestion(conversationId: string) {
  const { clinicId } = await requireClinicSession();
  await ownedConversation(conversationId, clinicId);
  await prisma.patientDataSuggestion.deleteMany({ where: { conversationId } });
}
