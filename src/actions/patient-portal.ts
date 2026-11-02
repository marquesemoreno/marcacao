"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit-server";
import { resolvePatientToken } from "@/lib/patient-token-server";
import { validateFormAnswers } from "@/lib/patient-form";
import { checkinWindow } from "@/lib/patient-journey";
import { encryptFormAnswers, ensureConsentTerm, getActiveFormTemplate, hashIp } from "@/lib/patient-form-server";
import { fetchBridgeDailyAgendaOrNull } from "@/lib/hospital-bridge";
import { greetingFirstName } from "@/lib/format";

/** Página do paciente /p/[token] (sem login): ficha prévia + "Cheguei". O token É a
 * credencial — tudo aqui parte dele, nunca de ids vindos do navegador. */

type Visit = { date: string; time: string | null; doctor: string | null };

async function visitOf(token: { clinicId: string; appointmentSource: string | null; appointmentExternalId: string | null; appointmentDate: Date | null }): Promise<Visit | null> {
  if (!token.appointmentDate || !token.appointmentExternalId) return null;
  const date = token.appointmentDate.toISOString().slice(0, 10);
  if (token.appointmentSource === "LOCAL") {
    const a = await prisma.appointment.findFirst({
      where: { id: token.appointmentExternalId, clinicProcedure: { clinicId: token.clinicId } },
      select: { timeSlot: true, doctorName: true },
    });
    return { date, time: a?.timeSlot ?? null, doctor: a?.doctorName ?? null };
  }
  const day = await fetchBridgeDailyAgendaOrNull(token.clinicId, date).catch(() => null);
  const item = day?.find((d) => String(d.numero) === token.appointmentExternalId);
  return { date, time: item?.hora ?? null, doctor: item?.medico ?? null };
}

export async function loadPatientPortal(raw: string) {
  const { state, token } = await resolvePatientToken(raw, "ANAMNESE");
  if (!token || state === "NOT_FOUND") return { state: "NOT_FOUND" as const };
  if (state !== "VALID") return { state };
  const [clinic, template, term, response, mark, visit] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: token.clinicId }, select: { tradeName: true, name: true } }),
    getActiveFormTemplate(token.clinicId),
    ensureConsentTerm(token.clinicId),
    prisma.patientFormResponse.findUnique({ where: { tokenId: token.id }, select: { submittedAt: true } }),
    token.appointmentSource && token.appointmentExternalId
      ? prisma.agendaMark.findUnique({
          where: { clinicId_source_externalId: { clinicId: token.clinicId, source: token.appointmentSource, externalId: token.appointmentExternalId } },
          select: { status: true },
        })
      : null,
    visitOf(token),
  ]);
  const contact = token.phone ? await prisma.contact.findUnique({ where: { phone: token.phone }, select: { name: true } }) : null;
  const clinicName = clinic?.tradeName || clinic?.name || "Clínica";
  return {
    state: "VALID" as const,
    clinicName,
    firstName: contact?.name ? greetingFirstName(contact.name) : null,
    visit,
    form: template && !response ? { questions: template.body.questions } : null,
    formDoneAt: response?.submittedAt.toISOString() ?? null,
    term: { id: term.id, title: term.title, body: term.body.replaceAll("{{clinica}}", clinicName) },
    checkedIn: mark?.status === "IN_SERVICE" || mark?.status === "COMPLETED",
    checkin: visit ? checkinWindow(visit.date, visit.time) : ("CLOSED" as const),
  };
}

export async function submitPatientForm(
  raw: string,
  input: Record<string, unknown>,
  termId: string,
  accepted: boolean
): Promise<{ ok: true } | { ok: false; error?: string; errors?: Record<string, string> }> {
  if (!accepted) return { ok: false, error: "Para enviar, marque que você leu e concorda." };
  const { state, token } = await resolvePatientToken(raw, "ANAMNESE");
  if (!token || state !== "VALID") return { ok: false, error: "Este link não vale mais. Peça um novo à clínica pelo WhatsApp." };
  const template = await getActiveFormTemplate(token.clinicId);
  if (!template) return { ok: false, error: "A clínica não está recebendo fichas agora." };
  const term = await prisma.consentTerm.findUnique({ where: { id: termId } });
  if (!term || (term.clinicId !== null && term.clinicId !== token.clinicId)) return { ok: false, error: "Termo inválido. Recarregue a página." };
  const v = validateFormAnswers(template.body.questions, input);
  if (!v.ok) return { ok: false, errors: v.errors };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  try {
    await prisma.$transaction(async (tx) => {
      const acceptance = await tx.consentAcceptance.create({
        data: {
          termId: term.id,
          clinicId: token.clinicId,
          phone: token.phone,
          contactId: token.contactId,
          ipHash: hashIp(ip),
          userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
        },
      });
      await tx.patientFormResponse.create({
        data: {
          clinicId: token.clinicId,
          templateId: template.id,
          tokenId: token.id, // único: o mesmo link não envia duas vezes
          phone: token.phone,
          contactId: token.contactId,
          appointmentSource: token.appointmentSource,
          appointmentExternalId: token.appointmentExternalId,
          appointmentDate: token.appointmentDate,
          answersEncrypted: encryptFormAnswers(v.answers),
          consentAcceptanceId: acceptance.id,
        },
      });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: true }; // já enviada (toque duplo)
    console.error("[ficha] falha ao gravar", e);
    return { ok: false, error: "Não conseguimos salvar agora. Tente de novo em instantes." };
  }
  return { ok: true };
}

export async function patientCheckIn(raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { state, token } = await resolvePatientToken(raw, "ANAMNESE");
  if (!token || state !== "VALID" || !token.appointmentSource || !token.appointmentExternalId || !token.appointmentDate) {
    return { ok: false, error: "Este link não vale mais. Avise na recepção que você chegou." };
  }
  const date = token.appointmentDate.toISOString().slice(0, 10);
  const visit = await visitOf(token);
  const win = checkinWindow(date, visit?.time ?? null);
  if (win === "EARLY") return { ok: false, error: "O “Cheguei” abre 2 horas antes da consulta." };
  if (win === "CLOSED") return { ok: false, error: "Esta consulta já passou." };
  const key = { clinicId_source_externalId: { clinicId: token.clinicId, source: token.appointmentSource, externalId: token.appointmentExternalId } };
  const before = await prisma.agendaMark.findUnique({ where: key, select: { status: true } });
  // Já chegou/atendido/cancelado/faltou pela recepção: não sobrescreve.
  if (before && before.status !== "CONFIRMED") return { ok: true };
  await prisma.agendaMark.upsert({
    where: key,
    update: { status: "IN_SERVICE", updatedByUserId: null },
    create: {
      clinicId: token.clinicId,
      source: token.appointmentSource,
      externalId: token.appointmentExternalId,
      date: token.appointmentDate,
      status: "IN_SERVICE",
      phone: token.phone,
    },
  });
  await recordAudit({
    clinicId: token.clinicId,
    userId: null,
    action: "portal.checkin",
    entity: `agenda:${token.appointmentSource}`,
    entityId: token.appointmentExternalId,
    before: before ? { status: before.status } : null,
    after: { status: "IN_SERVICE" },
  });
  return { ok: true };
}
