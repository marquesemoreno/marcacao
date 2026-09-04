"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createAppointmentSchema, type CreateAppointmentInput } from "@/lib/schemas/appointment";
import { sendAppointmentConfirmation } from "@/lib/whatsapp";
import { toPlainAppointment } from "@/lib/serialize";
import { AFFILIATE_REF_COOKIE, AFFILIATE_COMMISSION_FLAT } from "@/lib/affiliate";
import { isBridgeId, getBridgeClinicId, createBridgeAppointment } from "@/lib/hospital-bridge";

/**
 * `cookies()` só funciona dentro do ciclo de request do Next (Server Action
 * chamada via form/fetch do client, render de página). O teste de integração
 * em appointments.test.ts chama `createAppointment` direto, fora desse
 * contexto, e isso derruba `cookies()` com "outside a request scope" — por
 * isso o catch: fora de um request de verdade, simplesmente não há afiliado
 * pra atribuir.
 */
async function getAffiliateRefCode() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(AFFILIATE_REF_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function listUpcomingAppointments(clinicId: string) {
  const today = new Date();
  const startOfToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  return prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      date: { gte: startOfToday },
    },
    orderBy: { date: "asc" },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
}

export async function createAppointment(input: CreateAppointmentInput) {
  // ZodError não chega legível no client (o Next redige o erro em produção e
  // mostra só uma mensagem genérica) — converte pra um Error simples com o
  // motivo real antes de propagar pra Server Action.
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Dados do agendamento inválidos.");
  }
  const data = parsed.data;

  // Procedimento veio do sistema hospitalar da clínica (Firebird via bridge),
  // não do catálogo de ClinicProcedure do marketplace — grava lá em vez de aqui.
  if (isBridgeId(data.clinicProcedureId)) {
    return createBridgeAppointment(getBridgeClinicId(data.clinicProcedureId), {
      patientName: data.patientName,
      patientCpf: data.patientCpf,
      patientPhone: data.patientPhone,
      clinicProcedureId: data.clinicProcedureId,
      date: data.date,
      timeSlot: data.timeSlot,
      medicoId: data.medicoId,
      convenioId: data.convenioId,
      patientId: data.patientId,
    });
  }

  const affiliateCode = await getAffiliateRefCode();
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
    console.error("Falha ao notificar novo agendamento via WhatsApp:", error);
  }

  // Serializado (Decimal -> number) porque esta action é chamada direto de
  // Client Components (BookingDialog, CreateAppointmentShortcut do inbox) —
  // o valor de retorno cruza a fronteira Server->Client igual a props de
  // Server Component, e Decimal não é um tipo serializável nela.
  return toPlainAppointment(appointment);
}

export async function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
}
