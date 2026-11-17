"use server";

import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { type CreateAppointmentInput } from "@/lib/schemas/appointment";
import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate";
import { isBridgeId } from "@/lib/hospital-bridge";
import { getClinicSessionOrNull, requireAdminSession } from "@/lib/session";
import {
  clinicIdOfProcedure,
  createAppointmentForClinic,
  createCatalogAppointment,
  parseAppointmentInput,
} from "@/lib/appointment-create";

/** Todo export deste arquivo é endpoint chamável direto da internet. São dois, de propósito
 * (auditoria de segurança 16/11/2026, C1):
 * - `createAppointment`: PÚBLICA (site, sem login). Só catálogo de clínica listada no
 *   marketplace; nunca fala com a ponte da clínica.
 * - `createClinicAppointment`: painel (Chat, Agenda, Pacientes). Exige sessão e só agenda na
 *   clínica de quem está logado (o admin agenda em qualquer uma). */

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

async function visitorIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    return null; // fora de um request (teste de integração)
  }
}

// Freio do agendamento público: cada pedido manda um WhatsApp pelo número da clínica.
// Por telefone (no banco, vale entre instâncias): 3 pedidos por hora.
// Por visitante (em memória, por instância — segura o abuso casual): 5 a cada 10 min.
const MAX_PER_PHONE_PER_HOUR = 3;
const MAX_PER_VISITOR = 5;
const VISITOR_WINDOW_MS = 10 * 60_000;
const TOO_MANY = "Muitos pedidos de agendamento em pouco tempo. Aguarde alguns minutos ou fale com a clínica pelo WhatsApp.";
const visitors = new Map<string, number[]>();

function visitorLimited(ip: string | null, now = Date.now()): boolean {
  if (!ip) return false;
  const hits = (visitors.get(ip) ?? []).filter((t) => now - t < VISITOR_WINDOW_MS);
  if (hits.length >= MAX_PER_VISITOR) {
    visitors.set(ip, hits);
    return true;
  }
  hits.push(now);
  visitors.set(ip, hits);
  if (visitors.size > 5000) visitors.clear();
  return false;
}

const UNAVAILABLE = "Este agendamento não está disponível por aqui. Fale com a clínica pelo WhatsApp.";

/** Agendamento público do site. Só catálogo de clínica ativa e listada no marketplace. */
export async function createAppointment(input: CreateAppointmentInput) {
  const data = parseAppointmentInput(input);

  // Procedimento do sistema hospitalar (ponte) só pelo painel, com login: daqui qualquer
  // pessoa gravaria na agenda real da clínica.
  if (isBridgeId(data.clinicProcedureId)) throw new Error(UNAVAILABLE);

  const procedure = await prisma.clinicProcedure.findUnique({
    where: { id: data.clinicProcedureId },
    select: { clinic: { select: { active: true, listedInMarketplace: true } } },
  });
  if (!procedure || !procedure.clinic.active || !procedure.clinic.listedInMarketplace) throw new Error(UNAVAILABLE);

  const recentForPhone = await prisma.appointment.count({
    where: { patientPhone: data.patientPhone, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (recentForPhone >= MAX_PER_PHONE_PER_HOUR || visitorLimited(await visitorIp())) throw new Error(TOO_MANY);

  // Campos da ponte (médico, convênio, paciente cadastrado) não valem no site.
  return createCatalogAppointment(
    { ...data, medicoId: undefined, convenioId: undefined, patientId: undefined, arrivalOrder: undefined },
    await getAffiliateRefCode(),
  );
}

/** Agendamento pelo painel: clínica da sessão (ou, para o admin, a dona do procedimento). */
export async function createClinicAppointment(input: CreateAppointmentInput) {
  const clinicSession = await getClinicSessionOrNull();
  if (!clinicSession) await requireAdminSession();
  const data = parseAppointmentInput(input);
  const clinicId = clinicSession?.clinicId ?? (await clinicIdOfProcedure(data.clinicProcedureId));
  if (!clinicId) throw new Error("Procedimento não encontrado.");
  return createAppointmentForClinic(clinicId, data);
}
