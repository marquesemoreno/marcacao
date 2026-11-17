"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { formatToWhatsAppNumber } from "@/lib/whatsapp";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { errorSummary } from "@/lib/safe-error";
import { deletePatientRelatedData, removeConversationBackup, removeConversationMedia } from "@/lib/lgpd-server";
import { ANONYMIZED_NAME, maskPhone } from "@/lib/lgpd";

/** Conversas de um telefone em todas as clínicas — pra atender um pedido de exclusão.
 * Paciente que só fala pelo Instagram não tem telefone: busque pelo @usuario. */
export async function findPatientForDeletion(phone: string) {
  await requireAdminSession();
  const handle = phone.trim().startsWith("@") ? phone.trim().slice(1) : null;
  const full = handle ? null : formatToWhatsAppNumber(phone);
  const contact = await prisma.contact.findFirst({
    where: handle ? { instagramUsername: { equals: handle, mode: "insensitive" } } : { phone: full },
    select: {
      id: true,
      name: true,
      phone: true,
      conversations: { select: { id: true, createdAt: true, clinic: { select: { tradeName: true } }, _count: { select: { messages: true } } } },
    },
  });
  if (!contact) return null;
  return {
    name: contact.name,
    phone: contact.phone,
    conversations: contact.conversations.map((c) => ({
      id: c.id,
      clinic: c.clinic.tradeName,
      since: c.createdAt.toISOString(),
      messages: c._count.messages,
    })),
  };
}

/** Exclusão a pedido do titular (LGPD art. 18) numa clínica: apaga as mensagens e mídias
 * da conversa, o cadastro do paciente naquela clínica e os dados derivados (triagem, auditoria,
 * sugestões, IA). Se o paciente não fala com mais nenhuma clínica, anonimiza também nome e
 * telefone. Agendamentos NÃO são apagados (registro clínico tem guarda obrigatória).
 * Fica um DataDeletionRecord sem dado pessoal como prova. */
export async function anonymizePatientAdmin(input: { conversationId: string; reason: string; confirm: string }) {
  const { userId } = await requireAdminSession();
  if (input.confirm !== "EXCLUIR") return { success: false as const, error: "Digite EXCLUIR para confirmar." };
  if (input.reason.trim().length < 5) return { success: false as const, error: "Descreva o pedido (ex.: e-mail do titular de 20/10)." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { id: true, clinicId: true, contactId: true, contact: { select: { phone: true, _count: { select: { conversations: true } } } } },
  });
  if (!conversation) return { success: false as const, error: "Conversa não encontrada." };
  const otherConversations = conversation.contact._count.conversations - 1;

  // Mídias no storage (pasta = id da conversa), todas as páginas.
  const supabase = getSupabaseServerClient();
  if (supabase) await removeConversationMedia(supabase, conversation.id);

  const cid = conversation.id;
  const result = await prisma.$transaction(async (tx) => {
    await tx.message.updateMany({ where: { conversationId: cid, quotedMessageId: { not: null } }, data: { quotedMessageId: null } });
    const deleted = await tx.message.deleteMany({ where: { conversationId: cid } });
    await tx.messageTriage.deleteMany({ where: { conversationId: cid } });
    await tx.aiInteractionLog.deleteMany({ where: { conversationId: cid } });
    await tx.conversationQualityAudit.deleteMany({ where: { conversationId: cid } });
    await tx.patientDataSuggestion.deleteMany({ where: { conversationId: cid } });
    await tx.aiActionLog.deleteMany({ where: { conversationId: cid } });
    await tx.contactClinicProfile.deleteMany({ where: { contactId: conversation.contactId, clinicId: conversation.clinicId } });
    // Tarefas, automações, ficha prévia, senhas, NPS, lista de espera, campanhas…
    const related = await deletePatientRelatedData(tx, {
      clinicId: conversation.clinicId,
      conversationId: cid,
      contactId: conversation.contactId,
      phone: conversation.contact.phone,
    });
    await tx.conversation.update({
      where: { id: cid },
      data: {
        status: "RESOLVED",
        resolutionReason: "EXCLUSAO_LGPD",
        resolutionNotes: null,
        tags: [],
        estimatedValue: null,
        acquisitionDetail: null,
        patientIntent: null,
        assignedUserId: null,
        resolvedAt: new Date(),
      },
    });
    if (otherConversations === 0) {
      await tx.contact.update({
        where: { id: conversation.contactId },
        data: {
          name: ANONYMIZED_NAME,
          phone: null,
          photoUrl: null,
          instagramUsername: null,
          externalId: null,
          cpf: null,
          rg: null,
          birthDate: null,
          address: null,
          insuranceCardNumber: null,
          convenio: null,
          preferredDoctor: null,
          notes: null,
        },
      });
    }
    await tx.dataDeletionRecord.create({
      data: {
        clinicId: conversation.clinicId,
        conversationId: cid,
        maskedPhone: maskPhone(conversation.contact.phone),
        reason: input.reason.trim(),
        messagesDeleted: deleted.count,
        contactAnonymized: otherConversations === 0,
        performedByUserId: userId,
      },
    });
    return { messagesDeleted: deleted.count, contactAnonymized: otherConversations === 0, otherConversations, related };
  });
  // Cópias das mídias no backup externo (B2). Depois do banco: se o backup falhar, a
  // exclusão principal já valeu e a tela avisa para repetir.
  let backupRemoved: number | null = null;
  let backupFailed = false;
  try {
    backupRemoved = await removeConversationBackup(cid);
  } catch (error) {
    backupFailed = true;
    console.error("[lgpd] falha ao apagar mídias no backup:", errorSummary(error));
  }

  revalidatePath("/admin/lgpd");
  return { success: true as const, ...result, backupRemoved, backupFailed };
}

export async function listDeletionRecords() {
  await requireAdminSession();
  const rows = await prisma.dataDeletionRecord.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const clinics = await prisma.clinic.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.clinicId))] } }, select: { id: true, tradeName: true } });
  const name = new Map(clinics.map((c) => [c.id, c.tradeName]));
  return rows.map((r) => ({ ...r, clinic: name.get(r.clinicId) ?? "—", createdAt: r.createdAt.toISOString() }));
}
