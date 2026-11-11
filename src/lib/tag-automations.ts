/** Automações por tag (Disparos › Automações): "quando o paciente recebe a tag X, espera N,
 * e então envia um modelo aprovado ou deixa um lembrete para a recepção". Regras puras aqui;
 * a execução fica em src/lib/tag-automations-run.ts (cron a cada 10 min).
 *
 * A tag mora na conversa sem data (Conversation.tags), então "recebeu a tag" é detectado por
 * comparação: conversa com a tag e sem entrada na automação = acabou de receber. Ao ligar a
 * automação, quem já tinha a tag entra como BASELINE e não recebe nada (para falar com esses,
 * existe o público "Por tag" numa campanha comum). */
import { NON_PATIENT_TAG, WRONG_NUMBER_TAG } from "./conversation-tags";

export type TagAutomationAction = "MESSAGE" | "REMINDER";
/** TAG: a conversa recebeu a tag. STAGE: a conversa entrou na etapa do CRM (e segue em aberto). */
export type TagAutomationTrigger = "TAG" | "STAGE";
/** ENTRY: a espera conta de quando recebeu a tag / entrou na etapa. LAST_MESSAGE: conta da
 * última mensagem da conversa ("parado há N dias") — cada mensagem nova recomeça a contagem. */
export type TagAutomationWaitFrom = "ENTRY" | "LAST_MESSAGE";

export const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "NOVOS", label: "Novos" },
  { value: "TRIAGEM", label: "Em atendimento" },
  { value: "ORCAMENTO", label: "Orçamento" },
  { value: "AGENDADO", label: "Agendado" },
];
export const stageLabel = (stage: string | null | undefined) => STAGE_OPTIONS.find((o) => o.value === stage)?.label ?? "etapa";
/** REVIEW: a campanha nasce como rascunho e a recepção inicia. AUTO: já sai enviando. */
export type TagAutomationMode = "REVIEW" | "AUTO";
/** PENDING: esperando a hora. DONE: virou campanha ou lembrete. BASELINE: já tinha a tag
 * quando a automação ligou. SKIPPED: não dava para enviar (sem telefone, número errado). */
export type EnrollmentStatus = "PENDING" | "DONE" | "BASELINE" | "SKIPPED";

/** Tag que o lembrete põe na conversa, para a recepção filtrar no Chat e no CRM. */
export const REMINDER_TAG = "🔔 Lembrete";

export const MAX_DELAY_HOURS = 30 * 24;
export const MAX_TAG_AUTOMATIONS = 30;

export const DELAY_OPTIONS: { hours: number; label: string }[] = [
  { hours: 0, label: "na hora" },
  { hours: 1, label: "1 hora depois" },
  { hours: 3, label: "3 horas depois" },
  { hours: 24, label: "1 dia depois" },
  { hours: 48, label: "2 dias depois" },
  { hours: 72, label: "3 dias depois" },
  { hours: 168, label: "7 dias depois" },
  { hours: 360, label: "15 dias depois" },
  { hours: 720, label: "30 dias depois" },
];

export type TagAutomationInput = {
  name: string;
  triggerKind: TagAutomationTrigger;
  /** Só para triggerKind TAG. */
  tag: string;
  /** Só para triggerKind STAGE. */
  stage: string | null;
  delayHours: number;
  waitFrom: TagAutomationWaitFrom;
  /** Paciente escreveu depois de entrar na automação: não envia nem lembra. */
  stopOnReply: boolean;
  action: TagAutomationAction;
  mode: TagAutomationMode;
  reminderText: string;
  cloudTemplateName: string | null;
  cloudTemplateParams: string[];
  active: boolean;
};

export function validateTagAutomation(input: TagAutomationInput): string | null {
  const name = input.name.trim();
  const tag = input.tag.trim();
  if (!name || name.length > 60) return "Dê um nome à automação (até 60 letras).";
  if (input.triggerKind !== "TAG" && input.triggerKind !== "STAGE") return "Gatilho desconhecido.";
  if (input.triggerKind === "STAGE") {
    if (!STAGE_OPTIONS.some((o) => o.value === input.stage)) return "Escolha a etapa do CRM que dispara a automação.";
  } else {
    if (!tag || tag.length > 100) return "Escolha a tag que dispara a automação.";
    if (tag === WRONG_NUMBER_TAG || tag === REMINDER_TAG) return "Essa tag não pode disparar automação. Escolha outra tag.";
  }
  if (input.waitFrom !== "ENTRY" && input.waitFrom !== "LAST_MESSAGE") return "Forma de contar a espera desconhecida.";
  if (!Number.isInteger(input.delayHours) || input.delayHours < 0 || input.delayHours > MAX_DELAY_HOURS) {
    return "A espera vai de na hora até 30 dias.";
  }
  if (input.waitFrom === "LAST_MESSAGE" && input.delayHours < 1) return "Para contar o tempo parado, escolha uma espera de pelo menos 1 hora.";
  if (input.action !== "MESSAGE" && input.action !== "REMINDER") return "Ação desconhecida.";
  if (input.mode !== "REVIEW" && input.mode !== "AUTO") return "Modo de envio desconhecido.";
  if (input.action === "REMINDER") {
    const text = input.reminderText.trim();
    if (!text || text.length > 300) return "Escreva o lembrete para a recepção (até 300 letras).";
  } else if (input.active && !input.cloudTemplateName) {
    return "Escolha um modelo aprovado pela Meta antes de ligar.";
  }
  return null;
}

type TriggerShape = { triggerKind: string; tag: string; stage: string | null };

/** Filtro (Prisma) das conversas que estão no gatilho agora — sempre dentro da clínica. */
export function triggerWhere(a: TriggerShape & { clinicId: string }) {
  return a.triggerKind === "STAGE"
    ? { clinicId: a.clinicId, funnelStage: a.stage as "NOVOS" | "TRIAGEM" | "ORCAMENTO" | "AGENDADO", status: { not: "RESOLVED" as const } }
    : { clinicId: a.clinicId, tags: { has: a.tag } };
}

export function sameTrigger(a: TriggerShape, b: TriggerShape): boolean {
  if (a.triggerKind !== b.triggerKind) return false;
  return a.triggerKind === "STAGE" ? a.stage === b.stage : a.tag === b.tag;
}

/** Tempo parado: se a última mensagem ainda não tem `delayHours`, devolve o novo vencimento
 * (última mensagem + espera). null = já está parado o bastante, pode executar. */
export function idlePostponedDue(input: { lastMessageAt: Date | null; delayHours: number; now: Date }): Date | null {
  if (!input.lastMessageAt) return null;
  const due = new Date(input.lastMessageAt.getTime() + input.delayHours * 3_600_000);
  return due.getTime() > input.now.getTime() ? due : null;
}

export function planEnrollments(input: {
  delayHours: number;
  taggedConversationIds: string[];
  existing: { id: string; conversationId: string; status: string }[];
  now: Date;
}): { create: { conversationId: string; dueAt: Date }[]; removeIds: string[] } {
  const tagged = new Set(input.taggedConversationIds);
  const enrolled = new Set(input.existing.map((e) => e.conversationId));
  const dueAt = new Date(input.now.getTime() + input.delayHours * 3_600_000);
  return {
    create: [...tagged].filter((id) => !enrolled.has(id)).map((conversationId) => ({ conversationId, dueAt })),
    removeIds: input.existing.filter((e) => !tagged.has(e.conversationId)).map((e) => e.id),
  };
}

/** Por que uma conversa vencida não vira destinatário (null = pode enviar). */
export function messageSkipReason(conv: { phone: string | null; tags: string[] }, triggerTag: string): string | null {
  if (!conv.phone) return "sem telefone";
  if (conv.tags.includes(WRONG_NUMBER_TAG)) return "número errado";
  if (triggerTag !== NON_PATIENT_TAG && conv.tags.includes(NON_PATIENT_TAG)) return "não é paciente";
  return null;
}

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Dia (AAAA-MM-DD) em Brasília. */
export function brtDay(now: Date): string {
  return new Date(now.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Meia-noite de hoje em Brasília, como instante. */
export function brtDayStart(now: Date): Date {
  return new Date(`${brtDay(now)}T03:00:00Z`);
}

export function tagAutomationCampaignName(name: string, now: Date): string {
  const [, mm, dd] = brtDay(now).split("-");
  return `Automação · ${name} · ${dd}/${mm}`;
}

export function reminderNote(automationName: string, text: string): string {
  return `🔔 Lembrete automático (${automationName}): ${text.trim()}`;
}
