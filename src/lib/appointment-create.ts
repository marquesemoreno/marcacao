import "server-only";
import { errorSummary } from "@/lib/safe-error";
import { prisma } from "@/lib/prisma";
import { createAppointmentSchema, type CreateAppointmentInput } from "@/lib/schemas/appointment";
import { sendAppointmentConfirmation } from "@/lib/whatsapp";
import { toPlainAppointment } from "@/lib/serialize";
import { AFFILIATE_COMMISSION_FLAT } from "@/lib/affiliate";
import { isBridgeId, getBridgeClinicId, createBridgeAppointment } from "@/lib/hospital-bridge";

/** Criação de agendamento — parte que NÃO é endpoint (auditoria de segurança 16/11/2026, C1).
 * Fica em lib de propósito: todo export de arquivo "use server" é chamável sem sessão, e a
 * versão antiga deixava qualquer pessoa gravar no sistema da clínica pela ponte. Quem chama
 * daqui já sabe de qual clínica é (sessão do painel ou conversa da IA). */

type AppointmentData = ReturnType<typeof parseAppointmentInput>;

/** ZodError não chega legível no client (o Next redige o erro em produção e mostra só uma
 * mensagem genérica) — converte pra um Error simples com o motivo real. */
export function parseAppointmentInput(input: CreateAppointmentInput) {
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Dados do agendamento inválidos.");
  }
  return parsed.data;
}

/** Agendamento no catálogo (ClinicProcedure no Postgres) + confirmação por WhatsApp. Quem
 * chama já conferiu que o procedimento pode ser agendado por quem pediu. */
export async function createCatalogAppointment(data: AppointmentData, affiliateCode: string | null = null) {
  const affiliate = affiliateCode
    ? await prisma.affiliate.findUnique({ where: { code: affiliateCode.toUpperCase() } })
    : null;

  const appointment = await prisma.appointment.create({
    data: {
      patientName: data.patientName,
      patientCpf: data.patientCpf ?? "",
      patientPhone: data.patientPhone,
      clinicProcedureId: data.clinicProcedureId,
      date: new Date(`${data.date}T00:00:00Z`),
      timeSlot: data.timeSlot || null,
      notes: data.notes || null,
      affiliateId: affiliate?.id ?? null,
      affiliateCommission: affiliate ? AFFILIATE_COMMISSION_FLAT : null,
      commissionReleased: false,
    },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  // Dispara a mensagem oficial de confirmação no WhatsApp via Evolution API v2.
  // Com `await` — sem esperar, a função serverless da Vercel pode encerrar antes
  // do envio em segundo plano terminar (confirmado em produção: agendamento
  // gravava certinho, mensagem nunca saía). Em try/catch isolado: o agendamento
  // já é real a essa altura, uma falha só no envio não pode derrubar a resposta.
  try {
    await sendAppointmentConfirmation(appointment);
  } catch (error) {
    console.error("Falha ao notificar novo agendamento via WhatsApp:", errorSummary(error));
  }

  // Serializado (Decimal -> number): o retorno cruza a fronteira Server->Client.
  return toPlainAppointment(appointment);
}

/** Agendamento feito por alguém da clínica `clinicId` (painel ou atendente virtual): ponte
 * (Firebird) ou catálogo, sempre conferindo que o procedimento é DESSA clínica — o id vem do
 * navegador (ou do modelo de IA) e não é confiável. */
export async function createAppointmentForClinic(clinicId: string, data: AppointmentData) {
  if (isBridgeId(data.clinicProcedureId)) {
    if (getBridgeClinicId(data.clinicProcedureId) !== clinicId) {
      throw new Error("Procedimento não encontrado nesta clínica.");
    }
    return createBridgeAppointment(clinicId, {
      patientName: data.patientName,
      patientCpf: data.patientCpf,
      patientPhone: data.patientPhone,
      clinicProcedureId: data.clinicProcedureId,
      date: data.date,
      timeSlot: data.timeSlot,
      arrivalOrder: data.arrivalOrder,
      medicoId: data.medicoId,
      convenioId: data.convenioId,
      patientId: data.patientId,
      notes: data.notes,
    });
  }
  const procedure = await prisma.clinicProcedure.findUnique({
    where: { id: data.clinicProcedureId },
    select: { clinicId: true },
  });
  if (!procedure || procedure.clinicId !== clinicId) {
    throw new Error("Procedimento não encontrado nesta clínica.");
  }
  return createCatalogAppointment(data);
}

/** Clínica dona de um id de procedimento (ponte ou catálogo) — só para o admin, que agenda
 * em qualquer clínica. null = procedimento não existe. */
export async function clinicIdOfProcedure(clinicProcedureId: string): Promise<string | null> {
  if (isBridgeId(clinicProcedureId)) return getBridgeClinicId(clinicProcedureId) || null;
  const procedure = await prisma.clinicProcedure.findUnique({ where: { id: clinicProcedureId }, select: { clinicId: true } });
  return procedure?.clinicId ?? null;
}
