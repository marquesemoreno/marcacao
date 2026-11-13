/** Automações por tag (Disparos › Automações): "quando o paciente recebe a tag X, espera N,
 * e então envia um modelo aprovado ou deixa um lembrete para a recepção". Regras puras aqui;
 * a execução fica em src/lib/tag-automations-run.ts (cron a cada 10 min).
 *
 * A tag mora na conversa sem data (Conversation.tags), então "recebeu a tag" é detectado por
 * comparação: conversa com a tag e sem entrada na automação = acabou de receber. Ao ligar a
 * automação, quem já tinha a tag entra como BASELINE e não recebe nada (para falar com esses,
 * existe o público "Por tag" numa campanha comum). */
import { NON_PATIENT_TAG, WRONG_NUMBER_TAG } from "./conversation-tags";

/** MESSAGE: envia modelo aprovado. REMINDER: nota + tag para a recepção. LOST: finaliza a
 * conversa como "paciente não respondeu" (só pode ser o último passo). */
export type TagAutomationAction = "MESSAGE" | "REMINDER" | "LOST";

/** Motivo de finalização usado pelo passo LOST (ver REASON_LABELS em actions/inbox.ts). */
export const LOST_REASON = "SEM_RESPOSTA";
export const MAX_EXTRA_STEPS = 4;

/** Passo seguinte da sequência, como vem da tela. A espera conta do passo anterior. */
export type ExtraStepInput = {
  delayHours: number;
  action: TagAutomationAction;
  reminderText: string;
  cloudTemplateName: string | null;
  cloudTemplateParams: string[];
};
/** Passo como fica guardado (tag_automations.extra_steps) e como o executor lê. */
export type StoredStep = ExtraStepInput & { cloudTemplateLanguage: string | null; cloudTemplateBody: string | null };
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
  /** Só para ação MESSAGE: aviso de serviço (laudo pronto, convênio autorizou), não propaganda.
   * Vai também para quem não aceitou marketing; exige modelo da categoria Utilidade. */
  serviceNotice: boolean;
  action: TagAutomationAction;
  mode: TagAutomationMode;
  reminderText: string;
  cloudTemplateName: string | null;
  cloudTemplateParams: string[];
  /** Passos depois do primeiro (até MAX_EXTRA_STEPS). */
  extraSteps: ExtraStepInput[];
  active: boolean;
};

function stepProblem(step: { action: string; reminderText: string; cloudTemplateName: string | null }, active: boolean, label: string): string | null {
  if (step.action !== "MESSAGE" && step.action !== "REMINDER" && step.action !== "LOST") return `Ação desconhecida ${label}.`;
  if (step.action === "REMINDER") {
    const text = step.reminderText.trim();
    if (!text || text.length > 300) return `Escreva o lembrete para a recepção ${label} (até 300 letras).`;
  }
  if (step.action === "MESSAGE" && active && !step.cloudTemplateName) return `Escolha um modelo aprovado pela Meta ${label} antes de ligar.`;
  return null;
}

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
  if (input.mode !== "REVIEW" && input.mode !== "AUTO") return "Modo de envio desconhecido.";
  const extra = input.extraSteps ?? [];
  if (extra.length > MAX_EXTRA_STEPS) return `A sequência vai até ${MAX_EXTRA_STEPS + 1} passos.`;
  const first = stepProblem(input, input.active, extra.length ? "no passo 1" : "");
  if (first) return first.replace("  ", " ").replace(" .", ".").replace(" (", " (");
  for (const [i, step] of extra.entries()) {
    const label = `no passo ${i + 2}`;
    if (!Number.isInteger(step.delayHours) || step.delayHours < 1 || step.delayHours > MAX_DELAY_HOURS) return `A espera ${label} vai de 1 hora a 30 dias.`;
    const problem = stepProblem(step, input.active, label);
    if (problem) return problem;
  }
  const all = [input.action, ...extra.map((e) => e.action)];
  if (all.slice(0, -1).includes("LOST")) return "Finalizar a conversa só pode ser o último passo.";
  return null;
}

/** Lê extra_steps do banco sem confiar no formato (coluna JSON). */
export function parseStoredSteps(raw: unknown): StoredStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: StoredStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.action !== "MESSAGE" && o.action !== "REMINDER" && o.action !== "LOST") continue;
    steps.push({
      delayHours: typeof o.delayHours === "number" && Number.isInteger(o.delayHours) && o.delayHours >= 0 ? o.delayHours : 24,
      action: o.action,
      reminderText: typeof o.reminderText === "string" ? o.reminderText : "",
      cloudTemplateName: typeof o.cloudTemplateName === "string" ? o.cloudTemplateName : null,
      cloudTemplateLanguage: typeof o.cloudTemplateLanguage === "string" ? o.cloudTemplateLanguage : null,
      cloudTemplateBody: typeof o.cloudTemplateBody === "string" ? o.cloudTemplateBody : null,
      cloudTemplateParams: Array.isArray(o.cloudTemplateParams) ? o.cloudTemplateParams.filter((p): p is string => typeof p === "string") : [],
    });
  }
  return steps.slice(0, MAX_EXTRA_STEPS);
}

/** Todos os passos da automação, na ordem: o primeiro vem das colunas, o resto de extra_steps. */
export function stepsOf(a: {
  delayHours: number;
  action: string;
  reminderText: string | null;
  cloudTemplateName: string | null;
  cloudTemplateLanguage: string | null;
  cloudTemplateBody: string | null;
  cloudTemplateParams: string[];
  extraSteps?: unknown;
}): StoredStep[] {
  return [
    {
      delayHours: a.delayHours,
      action: a.action as TagAutomationAction,
      reminderText: a.reminderText ?? "",
      cloudTemplateName: a.cloudTemplateName,
      cloudTemplateLanguage: a.cloudTemplateLanguage,
      cloudTemplateBody: a.cloudTemplateBody,
      cloudTemplateParams: a.cloudTemplateParams,
    },
    ...parseStoredSteps(a.extraSteps),
  ];
}

type TriggerShape = { triggerKind: string; tag: string; stage: string | null };

/** Como a tag é comparada: sem maiúsculas, sem acentos, sem espaço sobrando. A recepção digita
 * "Teste", "teste" ou "TESTE" e é a mesma tag para a automação. */
export function tagKey(tag: string): string {
  return tag.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** A tag da automação mais as grafias dela que existem nas conversas da clínica. */
export function tagVariants(tag: string, clinicTags: string[]): string[] {
  const key = tagKey(tag);
  return [...new Set([tag, ...clinicTags.filter((t) => tagKey(t) === key)])];
}

/** Filtro (Prisma) das conversas que estão no gatilho agora — sempre dentro da clínica.
 * `variants`: grafias da tag (ver tagVariants); sem elas, compara a tag exata. */
export function triggerWhere(a: TriggerShape & { clinicId: string }, variants: string[] = [a.tag]) {
  if (a.triggerKind === "STAGE") {
    return { clinicId: a.clinicId, funnelStage: a.stage as "NOVOS" | "TRIAGEM" | "ORCAMENTO" | "AGENDADO", status: { not: "RESOLVED" as const } };
  }
  return variants.length > 1 ? { clinicId: a.clinicId, tags: { hasSome: variants } } : { clinicId: a.clinicId, tags: { has: variants[0] ?? a.tag } };
}

export function sameTrigger(a: TriggerShape, b: TriggerShape): boolean {
  if (a.triggerKind !== b.triggerKind) return false;
  return a.triggerKind === "STAGE" ? a.stage === b.stage : tagKey(a.tag) === tagKey(b.tag);
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

/** `step` (1, 2, 3…) só aparece no nome quando a automação tem mais de um passo. */
export function tagAutomationCampaignName(name: string, now: Date, step?: number): string {
  const [, mm, dd] = brtDay(now).split("-");
  return `Automação · ${name}${step ? ` · passo ${step}` : ""} · ${dd}/${mm}`;
}

export function lostNote(automationName: string): string {
  return `🏁 Atendimento finalizado pela automação "${automationName}" • Motivo: ⏳ Paciente Não Respondeu / Inativo`;
}

export function reminderNote(automationName: string, text: string): string {
  return `🔔 Lembrete automático (${automationName}): ${text.trim()}`;
}
