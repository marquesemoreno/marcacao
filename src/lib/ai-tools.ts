import "server-only";
import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { notifyAgenda } from "@/lib/realtime-server";
import {
  hasHospitalBridgeIntegration,
  fetchBridgeAgenda,
  fetchBridgeDoctors,
} from "@/lib/hospital-bridge";
import { getTivdcClinicId } from "@/lib/tivdc";
import { createGlpiTicket } from "@/lib/glpi";
import { formatPhone } from "@/lib/format";

/**
 * Function calling do atendente de IA (ver generateAiReply em ai-attendant.ts).
 * Escopo v1, só o pedido explícito: consultar agenda e registrar um PEDIDO de marcação
 * (BookingRequest, a fila "Pedidos de marcação" da Agenda) — a IA não grava agendamento:
 * quem marca é a recepção (auditoria de segurança 16/11/2026, M3).
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
        "Registra um PEDIDO de marcação do paciente desta conversa para a recepção. Não marca nada: a recepção confere a agenda e confirma o horário com o paciente. Depois de chamar, diga que o pedido foi anotado e que a recepção vai confirmar — nunca que está marcado.",
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

/** Pedido de marcação feito pela atendente virtual (auditoria de segurança 16/11/2026, M3).
 * Antes esta ferramenta chamava createAppointment: em clínica com ponte isso era um INSERT
 * no sistema da clínica + mensagem de confirmação, decidido só pelo texto do paciente — dava
 * para encher a agenda escrevendo instruções para a IA. Agora ela só REGISTRA O PEDIDO na
 * fila da Agenda ("Pedidos de marcação"); quem marca é a recepção.
 * Um pedido aberto por conversa: pedir de novo atualiza o mesmo, não empilha. */
async function runCriarPreAgendamento(
  context: ToolContext,
  args: { procedimento: string; data: string; horario?: string; medicoId?: number }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: context.conversationId },
    select: { clinicId: true, contact: { select: { name: true, phone: true } } },
  });
  if (!conversation || conversation.clinicId !== context.clinicId) return { erro: "Conversa não encontrada." };

  // O que vem do modelo não é confiável: formato conferido e tamanho cortado.
  const procedure = String(args.procedimento ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!procedure) return { erro: "Diga qual consulta ou exame o paciente quer." };
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(args.data ?? ""));
  if (!date) return { erro: "Data inválida — use o formato AAAA-MM-DD." };
  const time = /^\d{2}:\d{2}$/.test(String(args.horario ?? "")) ? String(args.horario) : null;
  const preferredDates = `${date[3]}/${date[2]}/${date[1]}${time ? ` às ${time}` : ""}`;

  let doctorName: string | null = null;
  if (typeof args.medicoId === "number" && (await hasHospitalBridgeIntegration(context.clinicId))) {
    const doctors = await fetchBridgeDoctors(context.clinicId).catch(() => []);
    doctorName = doctors.find((d) => Number(d.id) === args.medicoId)?.nome ?? null;
  }

  const fields = { procedure, doctorName, preferredDates, notes: "Pedido registrado pela atendente virtual." };
  try {
    const open = await prisma.bookingRequest.findFirst({
      where: { conversationId: context.conversationId, clinicId: context.clinicId, status: "OPEN" },
      select: { id: true },
    });
    if (open) {
      await prisma.bookingRequest.update({ where: { id: open.id }, data: fields });
    } else {
      await prisma.bookingRequest.create({
        data: {
          clinicId: context.clinicId,
          conversationId: context.conversationId,
          phone: conversation.contact.phone,
          patientName: conversation.contact.name,
          ...fields,
        },
      });
    }
    await notifyAgenda(context.clinicId);
    return {
      success: true,
      status: "PEDIDO REGISTRADO — a recepção vai conferir a agenda e confirmar o horário. NÃO diga que a consulta está marcada.",
    };
  } catch {
    return { erro: "Não foi possível registrar o pedido — diga que a recepção vai dar continuidade." };
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
    select: { contact: { select: { name: true, phone: true, glpiEntityId: true } } },
  });
  if (!conversation) return { erro: "Conversa não encontrada." };

  const descricao = args.descricao?.trim();
  if (!descricao) return { erro: "Descrição do problema vazia — peça mais detalhes ao cliente antes de tentar de novo." };

  const resumo = args.resumo?.trim() || descricao.split("\n")[0].slice(0, 80);
  const content = `Chamado aberto pela IA a partir de uma conversa do WhatsApp.\nContato: ${conversation.contact.name} (${conversation.contact.phone ? formatPhone(conversation.contact.phone) : "sem telefone"})\n\nDescrição do cliente:\n${descricao}`;

  const result = await createGlpiTicket(resumo, content, conversation.contact.glpiEntityId ?? undefined);
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
