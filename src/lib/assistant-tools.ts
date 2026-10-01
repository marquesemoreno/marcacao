import "server-only";
import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/appointment-availability";
import { findAppointmentsByIdentifier, type AppointmentMatch } from "@/lib/patient-lookup";
import { formatDate } from "@/lib/format";

/**
 * Tool calling do Copiloto da Recepção (ver runCopilotCommand em actions/copilot.ts).
 * Mesmo padrão de ai-tools.ts (atendente de IA do WhatsApp): tools definidas no
 * formato OpenAI function calling + executores que nunca lançam, sempre devolvem
 * um objeto serializável.
 *
 * Diferença importante: checkAvailability é 100% leitura e executa direto.
 * cancelAppointment e createCampaignDraft são de ESCRITA — os executores aqui
 * só fazem a parte de LEITURA (localizar agendamento / montar lista de
 * destinatários) e devolvem um `pendingAction`; a mutação real só acontece
 * nas Server Actions confirmCopilotCancelAppointment/confirmCopilotCampaignDraft
 * (actions/copilot.ts), chamadas só pelo clique explícito em "Confirmar Ação"
 * no `<ActionConfirmationCard />` — a IA nunca escreve no banco por conta própria.
 */

export type PendingCancelAction = {
  kind: "cancelAppointment";
  reason?: string;
  candidates: AppointmentMatch[];
};

export type CampaignRecipientDraft = { phone: string; name?: string };

export type PendingCampaignAction = {
  kind: "createCampaignDraft";
  campaignName: string;
  messageTemplate: string;
  targetFilterLabel: string;
  recipients: CampaignRecipientDraft[];
};

export type PendingAssistantAction = PendingCancelAction | PendingCampaignAction;

export const ASSISTANT_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "checkAvailability",
      description: "Consulta horários livres na agenda da clínica para uma data específica.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Data no formato AAAA-MM-DD." },
          doctorName: {
            type: "string",
            description: "Nome do médico (texto livre, opcional — não há cadastro de médico no sistema).",
          },
          period: { type: "string", enum: ["morning", "afternoon"], description: "Filtra manhã ou tarde. Opcional." },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelAppointment",
      description:
        "Localiza um agendamento pelo nome, telefone ou CPF do paciente. NÃO cancela — só retorna os dados encontrados para a recepcionista confirmar visualmente antes de qualquer alteração real.",
      parameters: {
        type: "object",
        properties: {
          patientIdentifier: { type: "string", description: "Nome, telefone ou CPF do paciente." },
          date: { type: "string", description: "Data do agendamento, se souber (AAAA-MM-DD). Opcional." },
          reason: { type: "string", description: "Motivo do cancelamento, se informado. Opcional." },
        },
        required: ["patientIdentifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createCampaignDraft",
      description:
        "Monta um rascunho de campanha de WhatsApp a partir de um filtro de público. NÃO envia — cria em status DRAFT, para revisão em /clinic/disparos.",
      parameters: {
        type: "object",
        properties: {
          targetFilter: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["tag", "procedure_no_return"],
                description:
                  "'tag' filtra por etiqueta de conversa; 'procedure_no_return' filtra pacientes que fizeram um procedimento e não voltaram.",
              },
              value: { type: "string", description: "Nome da tag, ou nome (ou parte do nome) do procedimento." },
              sinceDays: {
                type: "number",
                description: "Janela em dias pra considerar 'sem retorno' (default 90). Só vale para procedure_no_return.",
              },
            },
            required: ["type", "value"],
          },
          messageTemplate: { type: "string", description: "Texto da mensagem a enviar (pode usar {{nome}})." },
        },
        required: ["targetFilter", "messageTemplate"],
      },
    },
  },
];

type ToolContext = { clinicId: string };
type ToolExecutionResult = { forModel: Record<string, unknown>; pendingAction?: PendingAssistantAction };

async function runCheckAvailability(
  context: ToolContext,
  args: { date?: string; doctorName?: string; period?: "morning" | "afternoon" }
): Promise<Record<string, unknown>> {
  if (!args?.date) return { erro: "Informe a data a consultar." };
  const result = await getAvailableSlots(context.clinicId, args.date, {
    doctorName: args.doctorName,
    period: args.period,
  });
  if (result.closed) return { ...result, mensagem: "Clínica fechada nessa data." };
  if (result.slots.length === 0) return { ...result, mensagem: "Nenhum horário livre encontrado." };
  return result;
}

async function runCancelAppointment(
  context: ToolContext,
  args: { patientIdentifier?: string; date?: string; reason?: string }
): Promise<ToolExecutionResult> {
  if (!args?.patientIdentifier?.trim()) {
    return { forModel: { erro: "Informe nome, telefone ou CPF do paciente." } };
  }
  const candidates = await findAppointmentsByIdentifier(context.clinicId, args.patientIdentifier, args.date);
  if (candidates.length === 0) {
    return { forModel: { erro: "Nenhum agendamento ativo encontrado com esses dados." } };
  }
  return {
    forModel: {
      encontrados: candidates.length,
      agendamentos: candidates.map((c) => ({
        paciente: c.patientName,
        procedimento: c.procedureName,
        data: c.date,
        horario: c.timeSlot,
      })),
      aviso: "Aguardando confirmação explícita da recepcionista na tela antes de cancelar.",
    },
    pendingAction: { kind: "cancelAppointment", reason: args.reason, candidates },
  };
}

const DEFAULT_SINCE_DAYS = 90;

async function buildTagAudience(clinicId: string, tagValue: string): Promise<CampaignRecipientDraft[]> {
  const conversations = await prisma.conversation.findMany({
    where: { clinicId, tags: { has: tagValue } },
    select: { contact: { select: { phone: true, name: true } } },
  });
  const seen = new Set<string>();
  const recipients: CampaignRecipientDraft[] = [];
  for (const c of conversations) {
    if (!c.contact.phone || seen.has(c.contact.phone)) continue;
    seen.add(c.contact.phone);
    recipients.push({ phone: c.contact.phone, name: c.contact.name });
  }
  return recipients;
}

/** "Sem retorno" v1: concluiu o procedimento (status COMPLETED) há mais de
 * `sinceDays` dias e não tem nenhum agendamento (qualquer status/procedimento)
 * depois daquele. Não é um motor de segmentação genérico, só essa regra —
 * documentado aqui de propósito; a definição de "sem retorno" em
 * report-metrics.ts (não respondeu lembrete) tem outro objetivo e não é
 * reaproveitada aqui. */
async function buildProcedureNoReturnAudience(
  clinicId: string,
  procedureNameQuery: string,
  sinceDays: number
): Promise<CampaignRecipientDraft[]> {
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const completed = await prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId, procedure: { name: { contains: procedureNameQuery, mode: "insensitive" } } },
      status: "COMPLETED",
      date: { lte: cutoff },
    },
    select: { patientName: true, patientPhone: true, date: true },
    orderBy: { date: "desc" },
  });
  if (completed.length === 0) return [];

  const lastCompletedByPhone = new Map<string, { name: string; date: Date }>();
  for (const a of completed) {
    if (!lastCompletedByPhone.has(a.patientPhone)) {
      lastCompletedByPhone.set(a.patientPhone, { name: a.patientName, date: a.date });
    }
  }

  const phones = [...lastCompletedByPhone.keys()];
  const allForPhones = await prisma.appointment.findMany({
    where: { clinicProcedure: { clinicId }, patientPhone: { in: phones } },
    select: { patientPhone: true, date: true },
  });
  const maxDateByPhone = new Map<string, Date>();
  for (const a of allForPhones) {
    const cur = maxDateByPhone.get(a.patientPhone);
    if (!cur || a.date > cur) maxDateByPhone.set(a.patientPhone, a.date);
  }

  const recipients: CampaignRecipientDraft[] = [];
  for (const [phone, { name, date }] of lastCompletedByPhone) {
    const maxDate = maxDateByPhone.get(phone);
    if (!maxDate || maxDate.getTime() <= date.getTime()) {
      recipients.push({ phone, name });
    }
  }
  return recipients;
}

async function runCreateCampaignDraft(
  context: ToolContext,
  args: {
    targetFilter?: { type: "tag" | "procedure_no_return"; value: string; sinceDays?: number };
    messageTemplate?: string;
  }
): Promise<ToolExecutionResult> {
  const targetFilter = args?.targetFilter;
  const messageTemplate = args?.messageTemplate;
  if (!targetFilter?.value?.trim() || !messageTemplate?.trim()) {
    return { forModel: { erro: "Informe o filtro de público e o texto da mensagem." } };
  }

  const sinceDays = targetFilter.sinceDays ?? DEFAULT_SINCE_DAYS;
  const recipients =
    targetFilter.type === "tag"
      ? await buildTagAudience(context.clinicId, targetFilter.value)
      : await buildProcedureNoReturnAudience(context.clinicId, targetFilter.value, sinceDays);

  if (recipients.length === 0) {
    return { forModel: { erro: "Nenhum paciente encontrado para esse filtro." } };
  }

  const targetFilterLabel =
    targetFilter.type === "tag"
      ? `Etiqueta "${targetFilter.value}"`
      : `Fez "${targetFilter.value}" há mais de ${sinceDays} dias, sem retorno`;

  return {
    forModel: {
      destinatarios: recipients.length,
      filtro: targetFilterLabel,
      aviso: "Rascunho pronto — aguardando confirmação da recepcionista para criar (fica em DRAFT, não envia nada sozinho).",
    },
    pendingAction: {
      kind: "createCampaignDraft",
      campaignName: `Copiloto — ${targetFilterLabel} — ${formatDate(new Date())}`,
      messageTemplate,
      targetFilterLabel,
      recipients,
    },
  };
}

/** Executa uma tool call pelo nome, devolvendo sempre um resultado serializável
 * (nunca lança) — `forModel` vira a `content` da mensagem `role: "tool"` de volta
 * pro modelo; `pendingAction`, quando presente, é a fonte de verdade renderizada
 * pelo `<ActionConfirmationCard />` (não depende do texto que a IA escreve). */
export async function executeAssistantTool(name: string, rawArgs: string, context: ToolContext): Promise<ToolExecutionResult> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return { forModel: { erro: "Argumentos inválidos recebidos do modelo." } };
  }

  switch (name) {
    case "checkAvailability":
      return { forModel: await runCheckAvailability(context, args as { date?: string; doctorName?: string; period?: "morning" | "afternoon" }) };
    case "cancelAppointment":
      return runCancelAppointment(context, args as { patientIdentifier?: string; date?: string; reason?: string });
    case "createCampaignDraft":
      return runCreateCampaignDraft(
        context,
        args as { targetFilter?: { type: "tag" | "procedure_no_return"; value: string; sinceDays?: number }; messageTemplate?: string }
      );
    default:
      return { forModel: { erro: `Tool desconhecida: ${name}` } };
  }
}
