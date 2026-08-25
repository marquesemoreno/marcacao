import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlainClinicProcedureItem, PlainAppointment } from "@/lib/serialize";

/**
 * Prefixo que marca um id de procedimento/agendamento como vindo do sistema
 * hospitalar da Santa Clara (Firebird, via bridge) em vez do catálogo próprio
 * do marketplace — usado pra rotear createAppointment() e pra evitar mandar o
 * link de comprovante (que só existe pra agendamentos do nosso Postgres).
 */
const BRIDGE_ID_PREFIX = "bridge:santa-clara:";

type BridgeProcedure = { id: number; codigo: string; nome: string; valor: number };
type BridgeDoctor = { id: number; nome: string; crm: string };

function getBridgeConfig() {
  const apiUrl = process.env.SANTA_CLARA_API_URL;
  const apiToken = process.env.SANTA_CLARA_API_TOKEN;
  if (!apiUrl || !apiToken) return null;
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiToken };
}

export function isBridgeId(id: string): boolean {
  return id.startsWith(BRIDGE_ID_PREFIX);
}

function toBridgeProcedureId(servicoId: number): string {
  return `${BRIDGE_ID_PREFIX}${servicoId}`;
}

function fromBridgeProcedureId(id: string): number {
  return Number(id.slice(BRIDGE_ID_PREFIX.length));
}

/**
 * Só a Santa Clara tem instância própria de WhatsApp hoje — reaproveita esse
 * mesmo sinal (WhatsappInstance) pra decidir se os procedimentos/agendamentos
 * dessa clínica vêm do sistema hospitalar (Firebird) em vez do catálogo do
 * marketplace. Se outra clínica ganhar instância própria sem ter integração
 * hospitalar, isso precisa virar uma flag dedicada — hoje só existe uma bridge
 * configurada (env global, não por clínica), então o acoplamento é seguro.
 */
export async function hasSantaClaraBridgeIntegration(clinicId: string): Promise<boolean> {
  if (!getBridgeConfig()) return false;
  const instance = await prisma.whatsappInstance.findUnique({ where: { clinicId } });
  return Boolean(instance);
}

export async function fetchSantaClaraProcedures(): Promise<BridgeProcedure[]> {
  const config = getBridgeConfig();
  if (!config) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/procedimentos`, {
      headers: { "x-api-token": config.apiToken },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchSantaClaraDoctors(): Promise<BridgeDoctor[]> {
  const config = getBridgeConfig();
  if (!config) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/medicos`, {
      headers: { "x-api-token": config.apiToken },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function adaptBridgeProcedureToPlainItem(clinicId: string, proc: BridgeProcedure): PlainClinicProcedureItem {
  const now = new Date();
  const id = toBridgeProcedureId(proc.id);
  return {
    id,
    clinicId,
    procedureId: id,
    price: proc.valor,
    promotionalPrice: null,
    requiresAppointment: true,
    appointmentType: "SCHEDULED",
    procedure: {
      id,
      specialtyId: null,
      name: proc.nome,
      category: "CONSULTATION",
      tussCode: proc.codigo,
      description: null,
      preparationInstructions: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** Grava a marcação real no Firebird da Santa Clara via bridge (POST, só cria — nunca atualiza/apaga nada existente). */
export async function createSantaClaraBridgeAppointment(input: {
  patientName: string;
  patientCpf: string;
  patientPhone: string;
  clinicProcedureId: string;
  date: string;
  timeSlot?: string;
  medicoId?: string;
}): Promise<PlainAppointment> {
  const config = getBridgeConfig();
  if (!config) throw new Error("Integração com a Santa Clara não está configurada.");

  const servicoId = fromBridgeProcedureId(input.clinicProcedureId);
  const procedures = await fetchSantaClaraProcedures();
  const procedure = procedures.find((p) => p.id === servicoId);
  if (!procedure) throw new Error("Procedimento não encontrado no sistema da clínica.");

  // Erro de rede/timeout aqui é `TypeError`/`AbortError` cru do fetch, não um Error
  // nosso — sem esse try/catch ele sobe direto da Server Action e o Next exibe só a
  // mensagem genérica de erro de produção, escondendo o motivo real do usuário.
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}/api/agendamentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": config.apiToken },
      body: JSON.stringify({
        paciente_nome: input.patientName,
        paciente_cpf: input.patientCpf,
        servico_id: servicoId,
        medico_id: input.medicoId ? Number(input.medicoId) : undefined,
        data: input.date,
        hora: input.timeSlot || undefined,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "erro desconhecido";
    throw new Error(`Não foi possível falar com o sistema da clínica (${reason}). Tente novamente.`);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Não foi possível registrar o agendamento (HTTP ${response.status}).`);
  }

  const instance = await prisma.whatsappInstance.findFirst({ include: { clinic: true } });
  if (!instance) throw new Error("Clínica com integração hospitalar não encontrada.");

  const now = new Date();
  const procedureId = toBridgeProcedureId(servicoId);
  const appointmentId = `${BRIDGE_ID_PREFIX}${Date.now()}`;

  return {
    id: appointmentId,
    patientName: input.patientName,
    patientCpf: input.patientCpf,
    patientPhone: input.patientPhone,
    clinicProcedureId: procedureId,
    date: new Date(`${input.date}T00:00:00Z`),
    timeSlot: input.timeSlot || null,
    status: "PENDING",
    paymentMethod: null,
    notes: null,
    affiliateId: null,
    affiliateCommission: null,
    commissionReleased: false,
    reminderSentAt: null,
    reminderStatus: "PENDING",
    createdAt: now,
    updatedAt: now,
    clinicProcedure: {
      id: procedureId,
      clinicId: instance.clinicId,
      procedureId,
      requiresAppointment: true,
      appointmentType: "SCHEDULED",
      price: procedure.valor,
      promotionalPrice: null,
      clinic: { ...instance.clinic, commissionRate: Number(instance.clinic.commissionRate) },
      procedure: {
        id: procedureId,
        specialtyId: null,
        name: procedure.nome,
        category: "CONSULTATION",
        tussCode: procedure.codigo,
        description: null,
        preparationInstructions: null,
        createdAt: now,
        updatedAt: now,
      },
    },
  };
}
