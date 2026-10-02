"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { attachSignedUrls } from "@/lib/whatsapp-media";
import { toggleNinthDigit } from "@/lib/whatsapp";
import { buildPatientTimeline } from "@/lib/patient-timeline";
import { getChatContactHistory, listContactMedia } from "@/actions/inbox";

const MESSAGE_LIMIT = 150;

/** N1 — tudo que a página /clinic/pacientes/[id] mostra, numa chamada. `id` é o
 * conversationId (mesma convenção do resto do painel: uma conversa = um paciente nesta
 * clínica). Agendamentos vêm do nosso banco (incluindo os criados pela integração);
 * o bridge não expõe histórico por paciente, então marcações feitas direto na recepção
 * do sistema da clínica não aparecem — não criamos cadastro duplicado. */
export async function getPatientProfile(conversationId: string) {
  const { clinicId } = await requireClinicSession();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      assignedUser: { select: { name: true } },
      clinic: { select: { tradeName: true, hospitalIntegration: { select: { active: true } } } },
    },
  });
  if (!conversation || conversation.clinicId !== clinicId) return null;
  const phone = conversation.contact.phone;
  const phones = phone ? [phone, toggleNinthDigit(phone)].filter((p): p is string => !!p) : [];

  const [messages, messageCount, appointments, media, stageChanges, notes, broadcasts, reminders, rawAppointments] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId, type: { not: "INTERNAL_NOTE" }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_LIMIT,
      select: {
        id: true, direction: true, content: true, type: true, createdAt: true, mimeType: true, mediaPath: true,
        attachmentName: true, sentFromDevice: true, senderUser: { select: { name: true } },
      },
    }),
    prisma.message.count({ where: { conversationId, type: { not: "INTERNAL_NOTE" }, deletedAt: null } }),
    getChatContactHistory(conversationId),
    listContactMedia(conversationId),
    prisma.conversationStageChange.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { createdAt: true, fromStage: true, toStage: true, user: { select: { name: true } } },
    }),
    prisma.message.findMany({
      where: { conversationId, type: "INTERNAL_NOTE" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { createdAt: true, content: true, senderUser: { select: { name: true } } },
    }),
    phones.length
      ? prisma.broadcastRecipient.findMany({
          where: { phone: { in: phones }, campaign: { clinicId } },
          select: { createdAt: true, sentAt: true, status: true, campaign: { select: { name: true } } },
        })
      : [],
    phones.length
      ? prisma.bridgeReminderLog.findMany({ where: { clinicId, phone: { in: phones } }, select: { sentAt: true, response: true, respondedAt: true } })
      : [],
    phones.length
      ? prisma.appointment.findMany({
          where: { patientPhone: { in: phones }, clinicProcedure: { clinicId } },
          select: { createdAt: true, date: true, status: true, clinicProcedure: { select: { procedure: { select: { name: true } } } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [],
  ]);

  const timeline = buildPatientTimeline({
    conversationCreatedAt: conversation.createdAt,
    acquisitionChannel: conversation.acquisitionChannel,
    stageChanges: stageChanges.map((s) => ({ at: s.createdAt, from: s.fromStage, to: s.toStage, author: s.user?.name ?? null })),
    notes: notes.map((n) => ({ at: n.createdAt, content: n.content, author: n.senderUser?.name ?? null })),
    broadcasts: broadcasts.map((b) => ({ at: b.sentAt ?? b.createdAt, campaign: b.campaign.name, status: b.status })),
    reminders: reminders.map((r) => ({ at: r.respondedAt ?? r.sentAt, response: r.response })),
    appointments: rawAppointments.map((a) => ({
      at: a.createdAt,
      procedure: a.clinicProcedure.procedure.name,
      date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(a.date),
      status: a.status,
    })),
    resolved: conversation.resolvedAt ? { at: conversation.resolvedAt, reason: conversation.resolutionReason } : null,
  });

  const withUrls = await attachSignedUrls(messages);
  const c = conversation.contact;
  return {
    conversationId: conversation.id,
    clinicName: conversation.clinic.tradeName,
    hasClinicSystem: Boolean(conversation.clinic.hospitalIntegration?.active),
    contact: {
      name: c.name,
      phone: c.phone,
      instagramUsername: c.instagramUsername,
      photoUrl: c.photoUrl,
      cpf: c.cpf,
      rg: c.rg,
      birthDate: c.birthDate ? c.birthDate.toISOString().slice(0, 10) : null,
      address: c.address,
      convenio: c.convenio,
      insuranceCardNumber: c.insuranceCardNumber,
      preferredDoctor: c.preferredDoctor,
      notes: c.notes,
      patientSince: c.createdAt.toISOString(),
    },
    stage: conversation.funnelStage,
    status: conversation.status,
    channel: conversation.channel,
    acquisitionChannel: conversation.acquisitionChannel,
    consent: conversation.aiConsentStatus,
    attendant: conversation.assignedUser?.name ?? null,
    tags: conversation.tags,
    appointments,
    media,
    messageCount,
    messages: withUrls
      .map((m) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        type: m.type,
        at: m.createdAt.toISOString(),
        mediaUrl: m.mediaUrl ?? null,
        mimeType: m.mimeType,
        attachmentName: m.attachmentName,
        author: m.direction === "OUTBOUND" ? m.senderUser?.name ?? (m.sentFromDevice ? "Enviada pelo celular" : "Automática") : null,
      }))
      .reverse(),
    timeline: timeline.map((e) => ({ ...e, at: e.at.toISOString() })),
  };
}

export type PatientProfile = NonNullable<Awaited<ReturnType<typeof getPatientProfile>>>;
