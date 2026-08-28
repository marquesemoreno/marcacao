import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlainClinicProcedureItem, PlainAppointment } from "@/lib/serialize";

/**
 * Prefixo que marca um id de procedimento/agendamento como vindo do sistema
 * hospitalar de uma clínica (Firebird, via bridge) em vez do catálogo próprio
 * do marketplace — usado pra rotear createAppointment() e pra evitar mandar o
 * link de comprovante (que só existe pra agendamentos do nosso Postgres).
 * Carrega o clinicId embutido pra suportar várias clínicas com bridge ao
 * mesmo tempo sem colidir ids sintéticos entre elas.
 */
const BRIDGE_ID_PREFIX = "bridge:";

type BridgeProcedure = { id: number; codigo: string; nome: string; valor: number };
type BridgeDoctor = { id: number; nome: string; crm: string; especialidade: string | null };
export type BridgeConvenio = { id: number; nome: string };
export type BridgePatient = { id: number; nome: string; cpf: string | null };

async function getBridgeConfig(clinicId: string) {
  const integration = await prisma.hospitalIntegration.findUnique({ where: { clinicId } });
  if (!integration || !integration.active) return null;
  return { apiUrl: integration.apiUrl.replace(/\/$/, ""), apiToken: integration.apiToken };
}

export function isBridgeId(id: string): boolean {
  return id.startsWith(BRIDGE_ID_PREFIX);
}

/** Extrai o clinicId embutido num id sintético de procedimento/agendamento do bridge. */
export function getBridgeClinicId(id: string): string {
  return id.slice(BRIDGE_ID_PREFIX.length).split(":")[0];
}

function toBridgeProcedureId(clinicId: string, servicoId: number): string {
  return `${BRIDGE_ID_PREFIX}${clinicId}:${servicoId}`;
}

function fromBridgeProcedureId(id: string): number {
  return Number(id.split(":")[2]);
}

/** Diz se a clínica tem integração hospitalar ativa (bridge) — se não, o agendamento
 * cai no catálogo normal do marketplace (ClinicProcedure no Postgres). */
export async function hasHospitalBridgeIntegration(clinicId: string): Promise<boolean> {
  return (await getBridgeConfig(clinicId)) !== null;
}

/** Sem convenioId, o bridge usa o Particular por padrão (preço exibido reflete
 * esse convênio até o atendente escolher outro). */
export async function fetchBridgeProcedures(clinicId: string, convenioId?: number): Promise<BridgeProcedure[]> {
  const config = await getBridgeConfig(clinicId);
  if (!config) return [];
  try {
    const url = new URL(`${config.apiUrl}/api/procedimentos`);
    if (convenioId != null) url.searchParams.set("convenio_id", String(convenioId));
    const response = await fetch(url, {
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

export async function fetchBridgeConvenios(clinicId: string): Promise<BridgeConvenio[]> {
  const config = await getBridgeConfig(clinicId);
  if (!config) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/convenios`, {
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

export async function fetchBridgeDoctors(clinicId: string): Promise<BridgeDoctor[]> {
  const config = await getBridgeConfig(clinicId);
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

/** Busca paciente já cadastrado no sistema hospitalar por nome — deixa o atendente
 * reaproveitar um cadastro existente (evita duplicar paciente de retorno) em vez de
 * sempre criar um novo. Exige 2+ caracteres porque o bridge também exige isso e devolve
 * lista vazia antes disso, pra não escanear a tabela toda a cada tecla digitada. */
export async function fetchBridgePatients(clinicId: string, query: string): Promise<BridgePatient[]> {
  const config = await getBridgeConfig(clinicId);
  if (!config || query.trim().length < 2) return [];
  try {
    const url = new URL(`${config.apiUrl}/api/pacientes`);
    url.searchParams.set("q", query.trim());
    const response = await fetch(url, {
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

/** Horários já ocupados de um médico num dia, direto do sistema da clínica —
 * pra atendente ver a agenda antes de marcar, em vez de digitar um horário às
 * cegas. Ver comentário do endpoint no bridge: conta qualquer marcação
 * existente como ocupada, sem distinguir cancelada de confirmada. */
export async function fetchBridgeAgenda(clinicId: string, medicoId: number, date: string): Promise<string[]> {
  const config = await getBridgeConfig(clinicId);
  if (!config) return [];
  try {
    const response = await fetch(
      `${config.apiUrl}/api/agenda?medico_id=${encodeURIComponent(medicoId)}&data=${encodeURIComponent(date)}`,
      {
        headers: { "x-api-token": config.apiToken },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.horariosOcupados) ? data.horariosOcupados : [];
  } catch {
    return [];
  }
}

export function adaptBridgeProcedureToPlainItem(clinicId: string, proc: BridgeProcedure): PlainClinicProcedureItem {
  const now = new Date();
  const id = toBridgeProcedureId(clinicId, proc.id);
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

/** Grava a marcação real no Firebird da clínica via bridge (POST, só cria — nunca atualiza/apaga nada existente). */
export async function createBridgeAppointment(
  clinicId: string,
  input: {
    patientName: string;
    /** Opcional a pedido da Santa Clara — nem sempre o atendente consegue o CPF pelo
     * WhatsApp, e travar o agendamento por isso trazia mais problema que benefício. */
    patientCpf?: string;
    patientPhone: string;
    clinicProcedureId: string;
    date: string;
    timeSlot?: string;
    medicoId?: string;
    /** Paciente já cadastrado, escolhido via busca (fetchBridgePatients) — reaproveita
     * o cadastro em vez de criar um novo/depender do CPF pra achar o existente. */
    patientId?: string;
    /** Sem escolha do atendente, o bridge usa o Particular por padrão. */
    convenioId?: string;
  }
): Promise<PlainAppointment> {
  const config = await getBridgeConfig(clinicId);
  if (!config) throw new Error("Integração hospitalar não está configurada para esta clínica.");

  const servicoId = fromBridgeProcedureId(input.clinicProcedureId);
  const convenioId = input.convenioId ? Number(input.convenioId) : undefined;
  const procedures = await fetchBridgeProcedures(clinicId, convenioId);
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
        paciente_id: input.patientId ? Number(input.patientId) : undefined,
        paciente_celular: input.patientPhone,
        servico_id: servicoId,
        medico_id: input.medicoId ? Number(input.medicoId) : undefined,
        convenio_id: convenioId,
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

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) throw new Error("Clínica com integração hospitalar não encontrada.");

  // Espelha o agendamento (já real no Firebird a essa altura) num Appointment de
  // verdade no nosso Postgres — só pra relatório (getFinancialReport etc já
  // contam qualquer Appointment, sem filtro especial). Não usa esse id como
  // retorno da função: o id sintético "bridge:..." abaixo continua sendo o que
  // o front usa pra saber que não existe guia/QR Code pra esse agendamento.
  // Em try/catch isolado: o agendamento no Firebird já aconteceu de verdade a essa
  // altura, então uma falha aqui (só espelho pra relatório) não pode derrubar a
  // resposta de sucesso pro atendente.
  try {
    const dbProcedureName = `${procedure.nome} — ${clinic.tradeName} (Bridge)`;
    const dbProcedure = await prisma.procedure.upsert({
      where: { name: dbProcedureName },
      create: { name: dbProcedureName, category: "CONSULTATION", tussCode: procedure.codigo },
      update: { tussCode: procedure.codigo },
    });
    const dbClinicProcedure = await prisma.clinicProcedure.upsert({
      where: { clinicId_procedureId: { clinicId, procedureId: dbProcedure.id } },
      create: {
        clinicId,
        procedureId: dbProcedure.id,
        price: procedure.valor,
        requiresAppointment: true,
        appointmentType: "SCHEDULED",
      },
      update: { price: procedure.valor },
    });
    await prisma.appointment.create({
      data: {
        patientName: input.patientName,
        patientPhone: input.patientPhone,
        patientCpf: input.patientCpf ?? "",
        clinicProcedureId: dbClinicProcedure.id,
        date: new Date(`${input.date}T00:00:00Z`),
        timeSlot: input.timeSlot || null,
        status: "CONFIRMED",
        notes: `Agendado via bridge ${clinic.tradeName} — NUMERO Firebird: ${body?.numero ?? "?"}`,
      },
    });
  } catch (error) {
    console.error("Falha ao espelhar agendamento do bridge no Postgres (só relatório):", error);
  }

  const now = new Date();
  const procedureId = toBridgeProcedureId(clinicId, servicoId);
  const appointmentId = `${BRIDGE_ID_PREFIX}${clinicId}:${Date.now()}`;

  return {
    id: appointmentId,
    patientName: input.patientName,
    patientCpf: input.patientCpf ?? "",
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
      clinicId,
      procedureId,
      requiresAppointment: true,
      appointmentType: "SCHEDULED",
      price: procedure.valor,
      promotionalPrice: null,
      clinic: { ...clinic, commissionRate: Number(clinic.commissionRate) },
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
