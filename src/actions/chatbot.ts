"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkClinicBusinessHours } from "@/lib/business-hours";

function extractCpf(text: string): string | null {
  // Regex para CPF formatado 000.000.000-00 ou numérico de 11 dígitos
  const formattedMatch = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  if (formattedMatch) return formattedMatch[0];

  const digitsOnlyMatch = text.match(/\b\d{11}\b/);
  if (digitsOnlyMatch) {
    const d = digitsOnlyMatch[0];
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }

  return null;
}

function extractProcedureKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  const keywords = [
    "consulta",
    "ultrassom",
    "exame",
    "ecocardiograma",
    "ginecologia",
    "urologia",
    "hemograma",
    "raio-x",
    "tomografia",
    "ressonância",
    "sangue",
    "cardiologia",
    "ortopedia",
    "dermatologia",
    "endocrinologia",
    "pediatria",
    "checkup",
    "jejum",
  ];

  for (const kw of keywords) {
    if (lower.includes(kw)) {
      return kw.charAt(0).toUpperCase() + kw.slice(1);
    }
  }

  return null;
}

export async function processInboundChatbotTriage(
  conversationId: string,
  messageContent: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      clinic: true,
      contact: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!conversation) return;

  const { clinic, contact } = conversation;
  const businessHoursCheck = checkClinicBusinessHours(clinic.businessHours);

  // 1. Resposta Automática Fora de Expediente
  if (!businessHoursCheck.isOpen) {
    const alreadySentOutOfHoursRecently = conversation.messages.some(
      (m) => m.content.includes("FORA DE EXPEDIENTE") && (new Date().getTime() - new Date(m.createdAt).getTime() < 3600000)
    );

    if (!alreadySentOutOfHoursRecently) {
      await prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          type: "TEXT",
          content: businessHoursCheck.outOfHoursMessage,
          status: "SENT",
        },
      });
    }
  }

  // 2. Extração de Dados via IA (CPF & Procedimento)
  const foundCpf = extractCpf(messageContent);
  const foundProcedure = extractProcedureKeyword(messageContent);

  if (foundCpf || foundProcedure) {
    const updatedTags = Array.from(
      new Set([...conversation.tags, "⚡ Triado por IA", "🔬 Triagem Concluída"])
    );

    // Atualiza CPF do contato se localizado
    if (foundCpf && (!contact.cpf || contact.cpf === "")) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { cpf: foundCpf },
      });
    }

    // Atualiza etapa do funil da conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        funnelStage: "TRIAGEM",
        tags: updatedTags,
      },
    });

    const confirmationText = `🤖 *TRIAGEM IA REALIZADA COM SUCESSO*

Obrigado pelas informações! Identificamos os dados do seu atendimento:
${foundCpf ? `• *CPF:* ${foundCpf}\n` : ""}${foundProcedure ? `• *Interesse:* ${foundProcedure}\n` : ""}
Sua conversa foi movida para a *Fila de Atendimento Prioritário*. Um atendente da nossa recepção responderá em breve!`;

    const alreadySentTriageResponse = conversation.messages.some(
      (m) => m.content.includes("TRIAGEM IA REALIZADA")
    );

    if (!alreadySentTriageResponse) {
      await prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          type: "TEXT",
          content: confirmationText,
          status: "SENT",
        },
      });
    }
  }

  revalidatePath("/clinic/inbox");
  revalidatePath("/clinic/crm");
  revalidatePath("/admin/inbox");
}
