"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { recordPatientAccess } from "@/lib/access-log-server";
import { phoneVariants } from "@/lib/lgpd";
import { buildPatientExport, exportFileName } from "@/lib/patient-export";

/** Arquivo dos dados do titular (LGPD art. 18, II e V), pedido pelo próprio paciente. Só a
 * gestão gera; fica registrado em Acessos. A clínica entrega o arquivo ao titular depois de
 * conferir que é ele quem pediu. */
export async function exportPatientData(conversationId: string) {
  const { clinicId, userId } = await requireClinicPermission("config");
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
    select: {
      id: true,
      contactId: true,
      contact: { select: { name: true, phone: true, instagramUsername: true, clinicProfiles: { where: { clinicId }, take: 1 } } },
      clinic: { select: { name: true, cnpj: true } },
    },
  });
  if (!conversation) return { success: false as const, error: "Paciente não encontrado." };

  const phones = phoneVariants(conversation.contact.phone);
  const [channelConsents, acceptances, appointments, messages] = await Promise.all([
    phones.length
      ? prisma.channelConsent.findMany({ where: { clinicId, address: { in: phones } }, orderBy: { consentAt: "asc" } })
      : Promise.resolve([]),
    prisma.consentAcceptance.findMany({
      where: { clinicId, OR: [...(phones.length ? [{ phone: { in: phones } }] : []), { contactId: conversation.contactId }] },
      orderBy: { acceptedAt: "asc" },
      select: { acceptedAt: true, term: { select: { title: true } } },
    }),
    phones.length
      ? prisma.appointment.findMany({
          where: { clinicProcedure: { clinicId }, patientPhone: { in: phones } },
          orderBy: { date: "asc" },
          select: { date: true, timeSlot: true, status: true, clinicProcedure: { select: { procedure: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
    prisma.message.findMany({
      where: { conversationId: conversation.id, type: { not: "INTERNAL_NOTE" } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, direction: true, type: true, content: true },
    }),
  ]);

  const profile = conversation.contact.clinicProfiles[0] ?? null;
  const now = new Date();
  const data = buildPatientExport({
    generatedAt: now,
    clinic: conversation.clinic,
    contact: { name: conversation.contact.name, phone: conversation.contact.phone, instagramUsername: conversation.contact.instagramUsername },
    profile,
    channelConsents,
    termAcceptances: acceptances.map((a) => ({ termTitle: a.term.title, acceptedAt: a.acceptedAt })),
    appointments: appointments.map((a) => ({ date: a.date, timeSlot: a.timeSlot, status: a.status, procedure: a.clinicProcedure?.procedure?.name ?? null })),
    messages,
  });
  await recordPatientAccess({ clinicId, userId, conversationId: conversation.id, action: "EXPORTOU_DADOS" });
  return { success: true as const, fileName: exportFileName(now), json: JSON.stringify(data, null, 2) };
}
