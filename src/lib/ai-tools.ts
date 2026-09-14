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
import { getTivdcClinicId } from "@/lib/tivdc";
import { createGlpiTicket } from "@/lib/glpi";
import { formatPhone } from "@/lib/format";

/**
 * Function calling do atendente de IA (ver generateAiReply em ai-attendant.ts).
 * Escopo v1, só o pedido explícito: consultar agenda e criar um pré-agendamento
 * (nasce como Appointment.status PENDING — mesmo status de um agendamento feito
 * por uma atendente pelo modal, ninguém fica "confirmado" sem revisão humana).
 * Não é um agente autônomo de verdade (sem loop multi-step, sem outras tools);
 * é a base pra isso, não o produto final — testar com dado de mentira antes de
 * confiar a IA marcando consulta real de paciente.
 */
const BASE_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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

const GLPI_TOOL_DEFINITION: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "abrirChamadoSuporte",
    description:
      "Abre um chamado de suporte técnico no GLPI (help desk interno) quando o cliente relata um problema técnico ou pede suporte explicitamente. Só use quando o pedido for claramente um problema/solicitação de suporte de TI, não pra dúvida geral.",
    parameters: {
      type: "object",
      properties: {
        resumo: { type: "string", description: "Resumo curto do problema, em poucas palavras (vira o título do chamado)." },
        descricao: { type: "string", description: "Descrição completa do problema relatado pelo cliente, com o máximo de detalhe que ele deu." },
      },
      required: ["descricao"],
    },
  },
};

/** Monta a lista de tools disponíveis pra essa clínica — abrirChamadoSuporte só
 * entra pra TIVDC (ver getTivdcClinicId): é o help desk INTERNO da própria
 * empresa, não faz sentido oferecer isso pro atendente de IA de uma clínica
 * médica. As demais tools (agenda/pré-agendamento) valem pra qualquer clínica. */
export async function getAiToolDefinitions(clinicId: string): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
  const tivdcClinicId = await getTivdcClinicId();
  if (clinicId === tivdcClinicId) {
    return [...BASE_TOOL_DEFINITIONS, GLPI_TOOL_DEFINITION];
  }
  return BASE_TOOL_DEFINITIONS;
}

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

/** Só chamada quando a tool já foi oferecida (getAiToolDefinitions só inclui
 * pra TIVDC), mas confere de novo o clinicId aqui dentro também — sem confiar
 * só em "o modelo não deveria ter chamado isso", já que quem decide chamar a
 * tool é o próprio modelo, não um portão nosso. */
async function runAbrirChamadoSuporte(context: ToolContext, args: { resumo?: string; descricao: string }) {
  const tivdcClinicId = await getTivdcClinicId();
  if (context.clinicId !== tivdcClinicId) {
    return { erro: "Chamado no GLPI não está disponível pra esta clínica." };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: context.conversationId },
    select: { contact: { select: { name: true, phone: true } } },
  });
  if (!conversation) return { erro: "Conversa não encontrada." };

  const descricao = args.descricao?.trim();
  if (!descricao) return { erro: "Descrição do problema vazia — peça mais detalhes ao cliente antes de tentar de novo." };

  const resumo = args.resumo?.trim() || descricao.split("\n")[0].slice(0, 80);
  const content = `Chamado aberto pela IA a partir de uma conversa do WhatsApp.\nContato: ${conversation.contact.name} (${formatPhone(conversation.contact.phone)})\n\nDescrição do cliente:\n${descricao}`;

  const result = await createGlpiTicket(resumo, content);
  if (!result.success) return { erro: result.error };

  await prisma.message.create({
    data: {
      conversationId: context.conversationId,
      direction: "OUTBOUND",
      type: "INTERNAL_NOTE",
      content: `🎫 Chamado #${result.ticketId} aberto no GLPI pela IA.`,
      status: "SENT",
    },
  });

  return { success: true, ticketId: result.ticketId };
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
    case "abrirChamadoSuporte":
      return runAbrirChamadoSuporte(context, args as { resumo?: string; descricao: string });
    default:
      return { erro: `Tool desconhecida: ${name}` };
  }
}
