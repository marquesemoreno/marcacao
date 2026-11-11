import { errorSummary } from "@/lib/safe-error";
import "server-only";
import { prisma } from "@/lib/prisma";
import type { AiCallContext } from "@/lib/ai-gateway";

export type AiPrivacy = Omit<AiCallContext, "feature">;

/** O que a barreira LGPD precisa saber de uma conversa: nomes do paciente (cadastro
 * geral, perfil da clínica, responsável, @ do Instagram) para mascarar, e nomes da
 * clínica/atendente virtual para NÃO mascarar. Em erro devolve só o clinicId — o
 * gateway ainda mascara CPF, telefone, e-mail etc. pelos padrões. */
export async function privacyForConversation(conversationId: string): Promise<AiPrivacy> {
  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        clinicId: true,
        contact: {
          select: {
            name: true,
            instagramUsername: true,
            clinicProfiles: { select: { clinicId: true, guardianName: true } },
          },
        },
        clinic: {
          select: {
            name: true,
            tradeName: true,
            technicalDirectorName: true,
            aiAttendantConfig: { select: { assistantName: true } },
          },
        },
      },
    });
    if (!conv) return {};
    const profile = conv.contact.clinicProfiles.find((p) => p.clinicId === conv.clinicId);
    return {
      clinicId: conv.clinicId,
      knownNames: [conv.contact.name, profile?.guardianName, conv.contact.instagramUsername],
      preserveTerms: [
        conv.clinic.name,
        conv.clinic.tradeName,
        conv.clinic.technicalDirectorName,
        conv.clinic.aiAttendantConfig?.assistantName,
      ],
    };
  } catch (error) {
    console.error("Falha ao montar contexto de privacidade da IA:", errorSummary(error));
    return {};
  }
}

/** Para chamadas sem conversa (Copiloto da Recepção, relatório): só os nomes da
 * clínica a preservar. */
export async function privacyForClinic(clinicId: string): Promise<AiPrivacy> {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        name: true,
        tradeName: true,
        technicalDirectorName: true,
        aiAttendantConfig: { select: { assistantName: true } },
      },
    });
    return {
      clinicId,
      preserveTerms: [clinic?.name, clinic?.tradeName, clinic?.technicalDirectorName, clinic?.aiAttendantConfig?.assistantName],
    };
  } catch (error) {
    console.error("Falha ao montar contexto de privacidade da IA:", errorSummary(error));
    return { clinicId };
  }
}
