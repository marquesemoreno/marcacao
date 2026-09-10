import "server-only";
import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { createAppointment } from "@/actions/appointments";
import {
  hasHospitalBridgeIntegration,
  fetchBridgeAgenda,
  fetchBridgeProcedures,
  adaptBridgeProcedureToPlainItem,
} from "@/lib/hospital-bridge";

/**
 * Function calling do atendente de IA (ver generateAiReply em ai-attendant.ts).
 * Escopo v1, só o pedido explícito: consultar agenda e criar um pré-agendamento
 * (nasce como Appointment.status PENDING — mesmo status de um agendamento feito
 * por uma atendente pelo modal, ninguém fica "confirmado" sem revisão humana).
 * Não é um agente autônomo de verdade (sem loop multi-step, sem outras tools);
 * é a base pra isso, não o produto final — testar com dado de mentira antes de
 * confiar a IA marcando consulta real de paciente.
 */
export const AI_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "consultarHorariosDisponiveis",
      description:
        "Consulta os horários já OCUPADOS de um médico numa data (sistema da clínica). Não devolve horários livres prontos — informe ao paciente que a recepção confirma o horário exato, evitando só os horários listados como ocupados.",
      parameters: {
        type: "object",
        properties: {
          medicoId: { type: "number", description: "Id numérico do médico no sistema da clínica." },
          data: { type: "string", description: "Data no formato AAAA-MM-DD." },
        },
        required: ["medicoId", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criarPreAgendamento",
      description:
        "Cria um pré-agendamento (fica pendente de confirmação pela recepção, não é uma marcação definitiva) para o paciente desta conversa.",
      parameters: {
        type: "object",
        properties: {
          procedimento: { type: "string", description: "Nome do procedimento/consulta desejado (ex: 'Consulta com urologista')." },
          data: { type: "string", description: "Data desejada no formato AAAA-MM-DD." },
          horario: { type: "string", description: "Horário desejado, formato HH:MM. Opcional." },
          medicoId: { type: "number", description: "Id numérico do médico escolhido, se houver. Opcional." },
        },
        required: ["procedimento", "data"],
      },
    },
  },
];

type ToolContext = { conversationId: string; clinicId: string };

async function runConsultarHorariosDisponiveis(clinicId: string, args: { medicoId: number; data: string }) {
  if (!(await hasHospitalBridgeIntegration(clinicId))) {
    return { erro: "Esta clínica não tem consulta de agenda automatizada — peça pra recepção confirmar o horário." };
  }
  const horariosOcupados = await fetchBridgeAgenda(clinicId, args.medicoId, args.data);
  return { medicoId: args.medicoId, data: args.data, horariosOcupados };
}

/** Acha o clinicProcedureId (formato bridge ou marketplace, o mesmo que createAppointment
 * espera) casando pelo nome — busca simples por substring, primeira ocorrência.
 * Não tenta ser esperta (sem ranking/fuzzy match de verdade): num catálogo pequeno
 * e bem nomeado isso já resolve a maioria dos casos reais. */
async function resolveClinicProcedureId(clinicId: string, procedimentoQuery: string): Promise<string | null> {
  const normalized = procedimentoQuery.trim().toLowerCase();
  if (!normalized) return null;

  if (await hasHospitalBridgeIntegration(clinicId)) {
    const procedures = await fetchBridgeProcedures(clinicId);
    const match = procedures.find((p) => p.nome.toLowerCase().includes(normalized));
    return match ? adaptBridgeProcedureToPlainItem(clinicId, match).id : null;
  }

  const match = await prisma.clinicProcedure.findFirst({
    where: { clinicId, clinic: { active: true }, procedure: { name: { contains: normalized, mode: "insensitive" } } },
    select: { id: true },
  });
  return match?.id ?? null;
}

async function runCriarPreAgendamento(
  context: ToolContext,
  args: { procedimento: string; data: string; horario?: string; medicoId?: number }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: context.conversationId },
    select: { contact: { select: { name: true, phone: true, cpf: true } } },
  });
  if (!conversation) return { erro: "Conversa não encontrada." };

  const clinicProcedureId = await resolveClinicProcedureId(context.clinicId, args.procedimento);
  if (!clinicProcedureId) {
    return { erro: `Não encontrei o procedimento "${args.procedimento}" no catálogo desta clínica — descreva de outra forma ou peça pra recepção confirmar.` };
  }

  try {
    const appointment = await createAppointment({
      patientName: conversation.contact.name,
      patientCpf: conversation.contact.cpf ?? undefined,
      patientPhone: conversation.contact.phone,
      clinicProcedureId,
      date: args.data,
      timeSlot: args.horario,
      medicoId: args.medicoId != null ? String(args.medicoId) : undefined,
    });
    return { success: true, appointmentId: appointment.id, status: "PENDENTE — aguardando confirmação da recepção" };
  } catch (error) {
    return { erro: error instanceof Error ? error.message : "Não foi possível criar o pré-agendamento." };
  }
}

/** Executa uma tool call pelo nome, devolvendo sempre um objeto serializável em
 * JSON (nunca lança) — o conteúdo vira a `content` da mensagem `role: "tool"`
 * de volta pro modelo, que decide como explicar o resultado pro paciente. */
export async function executeAiTool(
  name: string,
  rawArgs: string,
  context: ToolContext
): Promise<Record<string, unknown>> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return { erro: "Argumentos inválidos recebidos do modelo." };
  }

  switch (name) {
    case "consultarHorariosDisponiveis":
      return runConsultarHorariosDisponiveis(context.clinicId, args as { medicoId: number; data: string });
    case "criarPreAgendamento":
      return runCriarPreAgendamento(context, args as { procedimento: string; data: string; horario?: string; medicoId?: number });
    default:
      return { erro: `Tool desconhecida: ${name}` };
  }
}
