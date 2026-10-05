"use server";

import { revalidatePath } from "next/cache";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { startOfUTCDay, addUTCDays } from "@/lib/date";
import { computeCampaignStats, phoneKey, type CampaignStats } from "@/lib/campaign-report";
import { RESCHEDULE_PENDING_TAG as CAMPAIGN_RESCHEDULE_TAG } from "@/lib/conversation-tags";
import {
  updateClinicProcedureSchema,
  addClinicProcedureSchema,
  updateAppointmentStatusSchema,
  businessHoursSchema,
  type BusinessHours,
} from "@/lib/schemas/clinic";
import { notifyAppointmentStatus } from "@/lib/whatsapp";
import {
  computeAttendantPerformance,
  computeConfirmationStats,
  computeTopDoctors,
  computeKindDistribution,
  computeHourlyInbound,
  computeBridgeConfirmationStats,
  mergeConfirmationStats,
  computeChannelConversion,
  UNIDENTIFIED_CHANNEL,
  computeResponseStats,
} from "@/lib/report-metrics";

export async function getClinicInfo() {
  const { clinicId } = await requireClinicSession();
  return prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    include: { whatsappInstance: { select: { id: true } } },
  });
}

export async function getClinicOverview() {
  const { clinicId } = await requireClinicSession();
  const todayStart = startOfUTCDay(new Date());
  const weekEnd = addUTCDays(todayStart, 7);

  const [todayCount, weekCount, pendingCount] = await Promise.all([
    prisma.appointment.count({
      where: { clinicProcedure: { clinicId }, date: todayStart },
    }),
    prisma.appointment.count({
      where: { clinicProcedure: { clinicId }, date: { gte: todayStart, lt: weekEnd } },
    }),
    prisma.appointment.count({
      where: { clinicProcedure: { clinicId }, status: "PENDING" },
    }),
  ]);

  return { todayCount, weekCount, pendingCount };
}

export async function listClinicAppointments(filters?: { status?: AppointmentStatus }) {
  const { clinicId } = await requireClinicSession();
  return prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    include: { clinicProcedure: { include: { procedure: true } } },
  });
}

/** Nomes distintos de tags usadas nas conversas da clínica no período — popula o
 * filtro "Tags" do relatório (ver /clinic/relatorio). Simples lista pra filtro, não
 * é gestão de tags (essa feature foi removida — ver memória do projeto). */
export async function getDistinctConversationTags(days: number = 30) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);
  const conversations = await prisma.conversation.findMany({
    where: { clinicId, createdAt: { gte: since }, tags: { isEmpty: false } },
    select: { tags: true },
  });
  return [...new Set(conversations.flatMap((c) => c.tags))].sort();
}

/** Relatório de atendimento/chat da clínica (ver /clinic/relatorio) — mesma lógica de
 * getAttendantPerformanceReport/getConversationQualityReport (admin.ts), só que filtrada
 * por clinicId em vez da plataforma inteira. Duplicado de propósito (mesmo padrão
 * clínica/admin usado no resto do projeto) em vez de generalizar as funções do admin.
 * `tags`, quando informado, filtra pra conversas que tenham QUALQUER uma delas. */
/** Filtro do relatório por Conversation.acquisitionChannel — UNIDENTIFIED_CHANNEL casa
 * as conversas sem canal (anteriores ao rastreamento ou abertas por lembrete/disparo). */
function channelWhere(channel?: string) {
  if (!channel) return {};
  return { acquisitionChannel: channel === UNIDENTIFIED_CHANNEL ? null : channel };
}

export async function getClinicChatReport(days: number = 30, tags?: string[], channel?: string) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);
  const tagsFilter = { ...(tags && tags.length > 0 ? { tags: { hasSome: tags } } : {}), ...channelWhere(channel) };

  const [conversations, audits] = await Promise.all([
    prisma.conversation.findMany({
      where: { clinicId, createdAt: { gte: since }, ...tagsFilter },
      select: { id: true, status: true, resolutionReason: true, createdAt: true, resolvedAt: true },
    }),
    // Filtra pela data da CONVERSA, não do audit — um audit é criado só quando a conversa
    // é resolvida, então filtrar pela própria data do audit deixava entrar conversas
    // abertas há semanas e resolvidas só agora, distorcendo a média de resolução pra
    // muito acima da realidade (bug real: média de 118h só por causa de 1 conversa velha).
    prisma.conversationQualityAudit.findMany({
      where: { conversation: { clinicId, createdAt: { gte: since }, ...tagsFilter } },
      select: { sentiment: true, firstResponseSec: true, resolutionSec: true },
    }),
  ]);

  const totalResolved = conversations.filter((c) => c.status === "RESOLVED").length;
  const totalAgendados = conversations.filter((c) => c.resolutionReason === "AGENDAMENTO_CONCLUIDO").length;
  const conversionRate = totalResolved > 0 ? Math.round((totalAgendados / totalResolved) * 1000) / 10 : 0;

  const withFrt = audits.filter((a) => a.firstResponseSec !== null);
  // Resolução só entra na média se a conversa teve resposta de verdade (firstResponseSec
  // não-nulo) — sem esse filtro, uma conversa esquecida por dias (sem ninguém responder)
  // e resolvida só depois pelo cron de "sem retorno" pesava sozinha a média pra centenas
  // de horas, mesmo não representando nenhum atendimento de fato.
  const withTtr = audits.filter((a) => a.resolutionSec !== null && a.firstResponseSec !== null);
  const avgFrtSec = withFrt.length > 0 ? Math.round(withFrt.reduce((acc, a) => acc + a.firstResponseSec!, 0) / withFrt.length) : null;
  const avgTtrSec = withTtr.length > 0 ? Math.round(withTtr.reduce((acc, a) => acc + a.resolutionSec!, 0) / withTtr.length) : null;

  const withSentiment = audits.filter((a) => a.sentiment !== null);
  const sentimentCounts = { POSITIVO: 0, NEUTRO: 0, NEGATIVO: 0 } as Record<string, number>;
  for (const a of withSentiment) {
    if (a.sentiment) sentimentCounts[a.sentiment] = (sentimentCounts[a.sentiment] ?? 0) + 1;
  }
  const sentimentPct = (key: string) =>
    withSentiment.length > 0 ? Math.round(((sentimentCounts[key] ?? 0) / withSentiment.length) * 1000) / 10 : 0;

  // D3: mediana em minutos de expediente, só com resposta humana (painel com atendente
  // ou enviada pelo celular — mensagem automática não conta). Uma query só pra todas as
  // conversas do período, não uma por conversa.
  const ids = conversations.map((c) => c.id);
  const timingRows = ids.length
    ? await prisma.$queryRaw<{ id: string; first_inbound: Date | null; first_reply: Date | null }[]>`
        SELECT c.id,
          fi.first_inbound,
          (SELECT MIN(m.created_at) FROM messages m
            WHERE m.conversation_id = c.id AND m.direction = 'OUTBOUND' AND m.type <> 'INTERNAL_NOTE'
              AND (m.sender_user_id IS NOT NULL OR m.sent_from_device = true)
              AND m.created_at > fi.first_inbound) AS first_reply
        FROM conversations c
        CROSS JOIN LATERAL (
          SELECT MIN(created_at) AS first_inbound FROM messages
          WHERE conversation_id = c.id AND direction = 'INBOUND'
        ) fi
        WHERE c.id = ANY(${ids})`
    : [];
  const resolvedAtById = new Map(conversations.map((c) => [c.id, c.resolvedAt]));
  const clinicHours = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { businessHours: true } });
  const responseStats = computeResponseStats(
    timingRows
      .filter((r) => r.first_inbound)
      .map((r) => ({ firstInboundAt: r.first_inbound!, firstHumanReplyAt: r.first_reply, resolvedAt: resolvedAtById.get(r.id) ?? null })),
    (clinicHours?.businessHours as BusinessHours | null) ?? null
  );

  return {
    responseStats,
    totalConversations: conversations.length,
    totalResolved,
    totalAgendados,
    conversionRate,
    avgFrtSec,
    avgTtrSec,
    sentimentPositivePct: sentimentPct("POSITIVO"),
    sentimentNeutroPct: sentimentPct("NEUTRO"),
    sentimentNegativoPct: sentimentPct("NEGATIVO"),
    sentimentAuditedCount: withSentiment.length,
  };
}

/** Relatório de agendamentos da clínica (ver /clinic/relatorio) — mesma fonte de valor
 * (clinicProcedure.price/promotionalPrice) já usada em getFinancialReport (admin.ts).
 * `doctorName`/`procedureId`, quando informados, filtram os agendamentos — só fazem
 * sentido aqui (não no relatório de chat): não existe vínculo entre Conversation e
 * Appointment no banco, então médico/procedimento não dá pra filtrar conversas. */
export async function getClinicAppointmentsReport(days: number = 30, doctorName?: string, procedureId?: string) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId, ...(procedureId ? { procedureId } : {}) },
      createdAt: { gte: since },
      ...(doctorName ? { doctorName } : {}),
    },
    include: { clinicProcedure: { include: { procedure: true } } },
  });

  const countByStatus: Record<AppointmentStatus, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  };
  for (const a of appointments) countByStatus[a.status]++;

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const revenue = completed.reduce(
    (sum, a) => sum + Number(a.clinicProcedure.promotionalPrice ?? a.clinicProcedure.price),
    0
  );

  const cancelledOrNoShow = countByStatus.CANCELLED + countByStatus.NO_SHOW;
  const cancellationRate = appointments.length > 0 ? Math.round((cancelledOrNoShow / appointments.length) * 1000) / 10 : 0;

  const procedureCounts = new Map<string, number>();
  for (const a of appointments) {
    const name = a.clinicProcedure.procedure.name;
    procedureCounts.set(name, (procedureCounts.get(name) ?? 0) + 1);
  }
  const topProcedures = [...procedureCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalAppointments: appointments.length,
    countByStatus,
    cancellationRate,
    revenue,
    topProcedures,
  };
}

/** Métricas de gestão do /clinic/relatorio (equipe, confirmações, médicos, tipo de
 * atendimento, horário de pico). Agregação em src/lib/report-metrics.ts. O atendente de
 * uma conversa é quem a resolveu (resolvedByUserId), senão quem está atribuído. */
export async function getClinicManagementReport(days: number = 30, channel?: string) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);

  const [allConversations, appointments, inbound, bridgeLogs, clinic] = await Promise.all([
    prisma.conversation.findMany({
      where: { clinicId, createdAt: { gte: since } },
      select: {
        acquisitionChannel: true,
        status: true,
        resolutionReason: true,
        resolvedByUserId: true,
        assignedUserId: true,
        qualityAudit: { select: { firstResponseSec: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { clinicProcedure: { clinicId }, createdAt: { gte: since } },
      select: {
        doctorName: true,
        status: true,
        date: true,
        reminderSentAt: true,
        reminderStatus: true,
        clinicProcedure: {
          select: { price: true, promotionalPrice: true, procedure: { select: { name: true, category: true } } },
        },
      },
    }),
    prisma.message.findMany({
      where: { direction: "INBOUND", createdAt: { gte: since }, conversation: { clinicId } },
      select: { createdAt: true },
    }),
    prisma.bridgeReminderLog.findMany({
      where: { clinicId, sentAt: { gte: since } },
      select: { response: true, sentAt: true },
    }),
    prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { defaultTicket: true } }),
  ]);
  const ticket = clinic.defaultTicket !== null ? Number(clinic.defaultTicket) : null;
  // Canal filtra só o que vem de conversa (equipe, faturamento) — agendamentos,
  // lembretes e mensagens não têm canal próprio. A tabela por canal usa todas.
  const conversations = channel
    ? allConversations.filter((c) => (c.acquisitionChannel ?? UNIDENTIFIED_CHANNEL) === channel)
    : allConversations;

  const userIds = [
    ...new Set(conversations.map((c) => c.resolvedByUserId ?? c.assignedUserId).filter((id): id is string => !!id)),
  ];
  // Só usuários da própria clínica — existe conversa da Santa Clara atribuída a uma
  // atendente da Urolaser no banco, e ela não pode aparecer no relatório de outra clínica.
  const users = await prisma.user.findMany({ where: { id: { in: userIds }, clinicId }, select: { id: true, name: true } });
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  const attendants = computeAttendantPerformance(
    conversations.map((c) => {
      const rawUserId = c.resolvedByUserId ?? c.assignedUserId;
      const userId = rawUserId && userNames.has(rawUserId) ? rawUserId : null;
      return {
        userId,
        userName: userId ? userNames.get(userId) ?? null : null,
        status: c.status,
        resolutionReason: c.resolutionReason,
        firstResponseSec: c.qualityAudit?.firstResponseSec ?? null,
      };
    })
  );

  // Faturamento Estimado: conversas finalizadas como agendamento × ticket médio (não há
  // vínculo Conversation↔Appointment pra saber o procedimento). Receita Protegida:
  // lembretes confirmados × preço do procedimento (agendamento nosso) ou ticket (bridge).
  const scheduledCount = conversations.filter((c) => c.resolutionReason === "AGENDAMENTO_CONCLUIDO").length;
  const bridgeConfirmations = computeBridgeConfirmationStats(bridgeLogs);
  const ownConfirmedValue = appointments
    .filter((a) => a.reminderStatus === "CONFIRMED")
    .reduce((sum, a) => {
      const price = Number(a.clinicProcedure.promotionalPrice ?? a.clinicProcedure.price);
      return sum + (price > 0 ? price : ticket ?? 0);
    }, 0);
  const protectedRevenue =
    ticket === null && ownConfirmedValue === 0 ? null : ownConfirmedValue + bridgeConfirmations.confirmed * (ticket ?? 0);

  return {
    ticket,
    estimatedRevenue: ticket !== null ? scheduledCount * ticket : null,
    scheduledCount,
    protectedRevenue,
    channelConversion: computeChannelConversion(allConversations, ticket),
    attendants,
    confirmations: mergeConfirmationStats(computeConfirmationStats(appointments), bridgeConfirmations),
    topDoctors: computeTopDoctors(appointments.map((a) => a.doctorName)),
    kindDistribution: computeKindDistribution(
      appointments.map((a) => ({
        procedureName: a.clinicProcedure.procedure.name,
        category: a.clinicProcedure.procedure.category,
      }))
    ),
    hourlyInbound: computeHourlyInbound(inbound.map((m) => m.createdAt)),
  };
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
  const { clinicId } = await requireClinicSession();
  const { status: validStatus } = updateAppointmentStatusSchema.parse({ status });

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
  if (!appointment || appointment.clinicProcedure.clinicId !== clinicId) {
    throw new Error("Agendamento não encontrado");
  }

  const isTargetConfirmedOrCompleted = validStatus === "CONFIRMED" || validStatus === "COMPLETED";
  const shouldReleaseCommission =
    isTargetConfirmedOrCompleted &&
    appointment.affiliateId &&
    appointment.affiliateCommission &&
    !appointment.commissionReleased;

  const shouldRevokeCommission =
    !isTargetConfirmedOrCompleted &&
    appointment.affiliateId &&
    appointment.affiliateCommission &&
    appointment.commissionReleased;

  let newCommissionReleased = appointment.commissionReleased;

  if (shouldReleaseCommission && appointment.affiliateId && appointment.affiliateCommission) {
    newCommissionReleased = true;
    await prisma.affiliate.update({
      where: { id: appointment.affiliateId },
      data: { totalEarned: { increment: appointment.affiliateCommission } },
    });
  } else if (shouldRevokeCommission && appointment.affiliateId && appointment.affiliateCommission) {
    newCommissionReleased = false;
    await prisma.affiliate.update({
      where: { id: appointment.affiliateId },
      data: { totalEarned: { decrement: appointment.affiliateCommission } },
    });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: validStatus,
      commissionReleased: newCommissionReleased,
    },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  // Com `await` — ver nota em appointments.ts sobre fire-and-forget não
  // sobreviver ao encerramento da função serverless na Vercel.
  try {
    await notifyAppointmentStatus(validStatus, updated);
  } catch (error) {
    console.error("Falha ao notificar mudança de status via WhatsApp:", error);
  }

  revalidatePath("/clinic/agendamentos");
  revalidatePath("/clinic");
}

/** Edição inline na tabela de /clinic/agendamentos — não existe cadastro de médico
 * no sistema, `doctorName` é texto livre digitado pela recepção (ver comentário no
 * schema). `null`/string vazia limpa o campo. */
export async function updateAppointmentDoctor(appointmentId: string, doctorName: string) {
  const { clinicId } = await requireClinicSession();

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { clinicProcedure: { select: { clinicId: true } } },
  });
  if (!appointment || appointment.clinicProcedure.clinicId !== clinicId) {
    throw new Error("Agendamento não encontrado");
  }

  const trimmed = doctorName.trim();
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { doctorName: trimmed || null },
  });

  revalidatePath("/clinic/agendamentos");
}

/** Nomes distintos já preenchidos em Appointment.doctorName pra essa clínica — popula
 * o seletor de médico do modal de remarcação em massa (ver reschedule-broadcast-modal). */
/** Canais de aquisição presentes nas conversas do período — opções do filtro do relatório. */
export async function getDistinctAcquisitionChannels(days: number = 30) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);
  const rows = await prisma.conversation.groupBy({
    by: ["acquisitionChannel"],
    where: { clinicId, createdAt: { gte: since } },
    _count: true,
  });
  return rows
    .map((r) => r.acquisitionChannel ?? UNIDENTIFIED_CHANNEL)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getDistinctDoctorNames() {
  const { clinicId } = await requireClinicSession();
  const rows = await prisma.appointment.findMany({
    where: { clinicProcedure: { clinicId }, doctorName: { not: null } },
    select: { doctorName: true },
    distinct: ["doctorName"],
    orderBy: { doctorName: "asc" },
  });
  return rows.map((r) => r.doctorName!).filter(Boolean);
}

/** Convênios distintos já cadastrados nos pacientes desta clínica — pro filtro
 * "Filtrar por Convênio" em /clinic/contatos (ver contacts-app.tsx). Contact não é
 * scoped por clínica direto (o mesmo paciente pode falar com várias) — filtra pelas
 * conversas que essa clínica tem com cada um. */
export async function getDistinctConvenios() {
  const { clinicId } = await requireClinicSession();
  const rows = await prisma.contact.findMany({
    where: { conversations: { some: { clinicId } }, convenio: { not: null } },
    select: { convenio: true },
    distinct: ["convenio"],
    orderBy: { convenio: "asc" },
  });
  return rows.map((r) => r.convenio!).filter(Boolean);
}

/** Pacientes agendados com um médico numa data específica — prévia do modal de
 * remarcação em massa antes de disparar o aviso. Só status ativos (PENDING/CONFIRMED),
 * não faz sentido avisar quem já foi atendido ou já cancelou. */
export async function getAppointmentsByDoctorAndDate(doctorName: string, date: Date) {
  const { clinicId } = await requireClinicSession();
  return prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      doctorName,
      date,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { id: true, patientName: true, patientPhone: true, timeSlot: true },
    orderBy: { timeSlot: "asc" },
  });
}

export async function listClinicProcedures() {
  const { clinicId } = await requireClinicSession();
  return prisma.clinicProcedure.findMany({
    where: { clinicId },
    include: { procedure: true },
    orderBy: { procedure: { name: "asc" } },
  });
}

export async function listProceduresNotOffered() {
  const { clinicId } = await requireClinicSession();
  const offered = await prisma.clinicProcedure.findMany({
    where: { clinicId },
    select: { procedureId: true },
  });
  const offeredIds = offered.map((item) => item.procedureId);
  return prisma.procedure.findMany({
    where: offeredIds.length ? { id: { notIn: offeredIds } } : undefined,
    orderBy: { name: "asc" },
  });
}

export async function updateClinicProcedure(clinicProcedureId: string, formData: FormData) {
  const { clinicId } = await requireClinicSession();
  const data = updateClinicProcedureSchema.parse({
    price: formData.get("price"),
    promotionalPrice: formData.get("promotionalPrice"),
    requiresAppointment: formData.get("requiresAppointment"),
    appointmentType: formData.get("appointmentType"),
  });

  const existing = await prisma.clinicProcedure.findUnique({ where: { id: clinicProcedureId } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Procedimento não encontrado");
  }

  await prisma.clinicProcedure.update({
    where: { id: clinicProcedureId },
    data,
  });
  revalidatePath("/clinic/precos");
}

/** Ticket médio de consulta particular (Clinic.defaultTicket) — usado no Faturamento
 * Estimado / Receita Protegida do /clinic/relatorio quando o procedimento não tem preço.
 * Campo vazio = sem estimativa. */
export async function updateClinicDefaultTicket(formData: FormData) {
  const { clinicId } = await requireClinicSession();
  const raw = String(formData.get("defaultTicket") ?? "").replace(",", ".").trim();
  const value = raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1_000_000)) {
    throw new Error("Valor inválido");
  }
  await prisma.clinic.update({ where: { id: clinicId }, data: { defaultTicket: value } });
  revalidatePath("/clinic/precos");
  revalidatePath("/clinic/relatorio");
}

/** Ticket médio (soma em R$ das colunas do CRM — N2). null = não configurado. */
export async function getClinicDefaultTicket() {
  const { clinicId } = await requireClinicSession();
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { defaultTicket: true } });
  return clinic.defaultTicket !== null ? Number(clinic.defaultTicket) : null;
}

export async function listAcquisitionRules() {
  const { clinicId } = await requireClinicSession();
  return prisma.acquisitionRule.findMany({
    where: { clinicId },
    orderBy: { createdAt: "asc" },
    select: { id: true, keyword: true, channel: true },
  });
}

/** Texto-chave de campanha → canal (ver detectAcquisition em src/lib/acquisition.ts). */
export async function addAcquisitionRule(formData: FormData) {
  const { clinicId } = await requireClinicSession();
  const keyword = String(formData.get("keyword") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  if (keyword.length < 3 || keyword.length > 200 || !channel || channel.length > 60) {
    throw new Error("Preencha o texto (mín. 3 caracteres) e o canal.");
  }
  await prisma.acquisitionRule.create({ data: { clinicId, keyword, channel } });
  revalidatePath("/clinic/precos");
}

export async function deleteAcquisitionRule(ruleId: string) {
  const { clinicId } = await requireClinicSession();
  await prisma.acquisitionRule.deleteMany({ where: { id: ruleId, clinicId } });
  revalidatePath("/clinic/precos");
}

export async function addClinicProcedure(formData: FormData) {
  const { clinicId } = await requireClinicSession();
  const data = addClinicProcedureSchema.parse({
    procedureId: formData.get("procedureId"),
    price: formData.get("price"),
    promotionalPrice: formData.get("promotionalPrice"),
    requiresAppointment: formData.get("requiresAppointment"),
    appointmentType: formData.get("appointmentType"),
  });

  await prisma.clinicProcedure.create({
    data: { clinicId, ...data },
  });
  revalidatePath("/clinic/precos");
}

const businessHoursDays = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;

export async function updateClinicBusinessHours(formData: FormData) {
  const { clinicId } = await requireClinicSession();

  const hours: Record<string, { closed?: boolean; open?: string; close?: string }> = {};
  for (const day of businessHoursDays) {
    const closed = formData.get(`${day}_closed`) === "on";
    hours[day] = closed
      ? { closed: true }
      : {
          open: String(formData.get(`${day}_open`) ?? "08:00"),
          close: String(formData.get(`${day}_close`) ?? "18:00"),
        };
  }
  const parsed: BusinessHours = businessHoursSchema.parse(hours);

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { businessHours: parsed },
  });
  revalidatePath("/clinic/precos");
}

export type CampaignReportRow = {
  id: string;
  name: string;
  status: "RUNNING" | "PAUSED" | "COMPLETED";
  tag: string | null;
  createdAt: string;
  stats: CampaignStats;
};

/** Campanhas de disparo (marketing) da clínica pro relatório: em andamento/pausadas, ou
 * criadas no período. Aviso de remarcação em massa fica de fora (não é campanha). */
export async function getClinicCampaignReport(days: number = 30): Promise<CampaignReportRow[]> {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);

  const campaigns = await prisma.broadcastCampaign.findMany({
    where: {
      clinicId,
      status: { not: "DRAFT" },
      // (Prisma: `not` em coluna nullable exclui os null — por isso o OR explícito.)
      AND: [
        { OR: [{ status: { in: ["RUNNING", "PAUSED"] } }, { createdAt: { gte: since } }] },
        { OR: [{ tagOnSend: null }, { tagOnSend: { not: CAMPAIGN_RESCHEDULE_TAG } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      status: true,
      tagOnSend: true,
      createdAt: true,
      recipients: { select: { phone: true, status: true, sentAt: true } },
    },
  });
  if (campaigns.length === 0) return [];

  // Contatos de todos os destinatários (com e sem o 9) + mensagens recebidas depois do
  // primeiro envio de cada campanha.
  const phones = new Set<string>();
  for (const c of campaigns) {
    for (const r of c.recipients) {
      const key = phoneKey(r.phone);
      phones.add(key);
      if (key.startsWith("55") && key.length === 12) phones.add(key.slice(0, 4) + "9" + key.slice(4));
    }
  }
  const firstSent = Math.min(
    ...campaigns.flatMap((c) => c.recipients.map((r) => r.sentAt?.getTime() ?? Infinity)),
  );
  const contacts = await prisma.contact.findMany({
    where: { phone: { in: [...phones] } },
    select: {
      phone: true,
      optedOutOfBroadcastsAt: true,
      conversations: {
        where: { clinicId },
        select: {
          funnelStage: true,
          messages: {
            where: { direction: "INBOUND", createdAt: { gt: Number.isFinite(firstSent) ? new Date(firstSent) : new Date() } },
            select: { createdAt: true },
          },
        },
      },
    },
  });
  const contactRows = contacts
    .filter((c) => c.phone)
    .map((c) => ({
      phone: c.phone as string,
      optedOutAt: c.optedOutOfBroadcastsAt,
      inboundAt: c.conversations.flatMap((cv) => cv.messages.map((m) => m.createdAt)),
      scheduled: c.conversations.some((cv) => cv.funnelStage === "AGENDADO"),
    }));

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status as CampaignReportRow["status"],
    tag: c.tagOnSend,
    createdAt: c.createdAt.toISOString(),
    stats: computeCampaignStats(c.recipients, contactRows),
  }));
}
