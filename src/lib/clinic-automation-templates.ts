/** Modelos prontos de automação para clínica (Disparos › Automações › "Começar de um modelo").
 * Instalar um modelo cria uma TagAutomation DESLIGADA e em revisão: nada vai para o paciente
 * até a gestão escolher os modelos aprovados pela Meta e ligar.
 *
 * Regra dos textos: a tela de bloqueio do celular é pública. Nenhum texto que vai para o
 * paciente nomeia doença, exame, procedimento ou especialidade (ver findClinicalTerm). */
import type { ExtraStepInput, TagAutomationInput } from "./tag-automations";

export type AutomationTemplateKey = "PAROU_ANTES_DE_MARCAR" | "PEDIDO_NAO_MARCADO" | "ORCAMENTO_EM_DECISAO" | "FALTOU";

/** Tag que a Agenda põe na conversa quando a recepção marca "Faltou" (e tira ao desfazer). */
export const MISSED_TAG = "😶 Faltou";
/** Tag que a recepção põe quando o médico pediu algo para marcar (sem dizer o quê). */
export const PENDING_ORDER_TAG = "📋 Pedido para marcar";

/** Texto sugerido para pedir o modelo à Meta. {{1}} = primeiro nome do paciente. */
export type TemplateSuggestion = { name: string; category: "UTILITY" | "MARKETING"; body: string };

type Step = Omit<ExtraStepInput, "cloudTemplateName" | "cloudTemplateParams"> & { suggestion?: TemplateSuggestion };

type AutomationTemplate = {
  key: AutomationTemplateKey;
  title: string;
  /** Uma frase para a gestão: quando dispara e o que faz. */
  description: string;
  trigger: Pick<TagAutomationInput, "triggerKind" | "tag" | "stage" | "waitFrom" | "serviceNotice">;
  steps: Step[];
};

const msg = (delayHours: number, suggestion: TemplateSuggestion): Step => ({ delayHours, action: "MESSAGE", reminderText: "", suggestion });
const task = (delayHours: number, reminderText: string): Step => ({ delayHours, action: "REMINDER", reminderText });
const DAY = 24;

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "PAROU_ANTES_DE_MARCAR",
    title: "Conversa parou antes de marcar",
    description: "Em atendimento e 1 dia sem mensagem: 3 lembretes gentis em 10 dias. Sem resposta, finaliza como “não respondeu”.",
    trigger: { triggerKind: "STAGE", tag: "", stage: "TRIAGEM", waitFrom: "LAST_MESSAGE", serviceNotice: false },
    steps: [
      msg(1 * DAY, {
        name: "conversa_parada_1",
        category: "MARKETING",
        body: "Olá, {{1}}! Vimos que a nossa conversa ficou pela metade. Quer que a gente veja um horário para você? É só responder esta mensagem.",
      }),
      msg(3 * DAY, {
        name: "conversa_parada_2",
        category: "MARKETING",
        body: "Oi, {{1}}! Continuamos à disposição para encontrar um horário que funcione para você. Se preferir, responda com o melhor dia e período.",
      }),
      msg(6 * DAY, {
        name: "conversa_parada_3",
        category: "MARKETING",
        body: "Olá, {{1}}! Esta é a nossa última mensagem sobre o agendamento. Quando quiser marcar, é só chamar aqui. Estamos à disposição.",
      }),
      { delayHours: 2 * DAY, action: "LOST", reminderText: "" },
    ],
  },
  {
    key: "PEDIDO_NAO_MARCADO",
    title: "Pedido do médico ainda não marcado",
    description: `A recepção põe a tag “${PENDING_ORDER_TAG}”: 2 avisos em 1 semana e, sem resposta, tarefa para ligar.`,
    trigger: { triggerKind: "TAG", tag: PENDING_ORDER_TAG, stage: null, waitFrom: "ENTRY", serviceNotice: true },
    steps: [
      msg(2 * DAY, {
        name: "pedido_nao_marcado_1",
        category: "UTILITY",
        body: "Olá, {{1}}! O agendamento indicado na sua última visita ainda está em aberto aqui na clínica. Quer que a gente veja um horário? É só responder esta mensagem.",
      }),
      msg(5 * DAY, {
        name: "pedido_nao_marcado_2",
        category: "UTILITY",
        body: "Oi, {{1}}! Passando para lembrar do agendamento em aberto. Se já marcou em outro lugar, é só avisar que a gente atualiza aqui.",
      }),
      task(2 * DAY, "Ligar para o paciente: o pedido do médico ainda não foi marcado e ele não respondeu às mensagens."),
    ],
  },
  {
    key: "ORCAMENTO_EM_DECISAO",
    title: "Orçamento em decisão",
    description: "Na etapa Orçamento: depois da fila de orçamentos (3, 7 e 15 dias), 4 mensagens sem pressão em cerca de 3 meses.",
    trigger: { triggerKind: "STAGE", tag: "", stage: "ORCAMENTO", waitFrom: "ENTRY", serviceNotice: false },
    steps: [
      msg(21 * DAY, {
        name: "orcamento_decisao_1",
        category: "MARKETING",
        body: "Olá, {{1}}! Tudo bem? Se ficou alguma dúvida sobre o orçamento que enviamos, estamos à disposição para conversar. Sem pressa.",
      }),
      msg(21 * DAY, {
        name: "orcamento_decisao_2",
        category: "MARKETING",
        body: "Oi, {{1}}! Sabemos que é uma decisão que leva tempo. Se quiser rever valores, formas de pagamento ou datas, é só responder aqui.",
      }),
      msg(21 * DAY, {
        name: "orcamento_decisao_3",
        category: "MARKETING",
        body: "Olá, {{1}}! Passando só para dizer que continuamos à disposição. Quando for o momento certo para você, é só chamar.",
      }),
      msg(28 * DAY, {
        name: "orcamento_decisao_4",
        category: "MARKETING",
        body: "Oi, {{1}}! Esta é a nossa última mensagem sobre o orçamento. Se quiser retomar a conversa no futuro, estaremos por aqui.",
      }),
    ],
  },
  {
    key: "FALTOU",
    title: "Paciente faltou",
    description: `Quando a Agenda marca “Faltou” (tag “${MISSED_TAG}”): convite para remarcar 2 h depois, mais 2 em 11 dias e, sem resposta, tarefa para ligar.`,
    trigger: { triggerKind: "TAG", tag: MISSED_TAG, stage: null, waitFrom: "ENTRY", serviceNotice: true },
    steps: [
      msg(2, {
        name: "faltou_remarcar_1",
        category: "UTILITY",
        body: "Olá, {{1}}! Sentimos sua falta hoje. Imprevistos acontecem: quer que a gente veja um novo horário? É só responder esta mensagem.",
      }),
      msg(4 * DAY, {
        name: "faltou_remarcar_2",
        category: "UTILITY",
        body: "Oi, {{1}}! Seu horário ainda não foi remarcado. Responda com o melhor dia e período que a gente encontra uma vaga.",
      }),
      msg(7 * DAY, {
        name: "faltou_remarcar_3",
        category: "UTILITY",
        body: "Olá, {{1}}! Esta é a nossa última mensagem sobre a remarcação. Quando quiser, é só chamar aqui.",
      }),
      task(1 * DAY, "Ligar para o paciente que faltou: ele não respondeu aos convites para remarcar."),
    ],
  },
];

const byKey = (key: string | null | undefined) => AUTOMATION_TEMPLATES.find((t) => t.key === key);

export function isAutomationTemplateKey(key: unknown): key is AutomationTemplateKey {
  return typeof key === "string" && !!byKey(key);
}

/** Formulário da automação como o modelo nasce: desligado, em revisão, para na resposta.
 * As mensagens ficam sem modelo da Meta: a gestão escolhe antes de ligar. */
export function templateInput(key: AutomationTemplateKey): TagAutomationInput {
  const t = byKey(key);
  if (!t) throw new Error("Modelo de automação desconhecido.");
  const [first, ...rest] = t.steps.map((s) => ({ delayHours: s.delayHours, action: s.action, reminderText: s.reminderText, cloudTemplateName: null, cloudTemplateParams: [] as string[] }));
  return {
    name: t.title,
    ...t.trigger,
    ...first,
    stopOnReply: true,
    mode: "REVIEW",
    extraSteps: rest,
    active: false,
  };
}

/** Texto sugerido de cada passo (null nos passos que não mandam mensagem). */
export function templateSuggestions(key: string | null | undefined): (TemplateSuggestion | null)[] {
  return byKey(key)?.steps.map((s) => s.suggestion ?? null) ?? [];
}

/** Termos que não podem aparecer em texto que vai para o paciente (comparados sem acento e
 * sem maiúscula, como início de palavra). Não é lista completa: é a rede de segurança dos
 * textos fixos do sistema. */
const CLINICAL_TERMS = [
  "exame", "cirurg", "procedimento", "biopsia", "laudo", "diagnost", "tratamento", "remedio", "medicament", "receita",
  "cancer", "tumor", "prostat", "vasectom", "mamograf", "ultrass", "ecograf", "tomograf", "ressonanc", "endoscop", "colonoscop", "papanicolau",
  "urolog", "ginecolog", "cardiolog", "dermatolog", "ortoped", "oftalmolog", "otorrino", "pediatr", "psiquiatr", "oncolog", "neurolog", "endocrin",
  "gastro", "odonto", "dentist", "obstetr", "gravidez", "gestac", "pre-natal", "prenatal", "fertilid", "infertil",
  "calculo renal", "diabet", "hipertens", "depress", "ansiedade",
];

/** Siglas curtas: só como palavra inteira ("ist" não pode acusar "isto"). */
const CLINICAL_WORDS = ["psa", "hiv", "ist", "dst", "hpv"];

export function findClinicalTerm(text: string): string | null {
  const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const term of CLINICAL_TERMS) {
    const at = new RegExp(`(^|[^a-z])${term.replace(/[-]/g, "[- ]?")}`).exec(plain);
    if (at) return term;
  }
  for (const word of CLINICAL_WORDS) if (new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(plain)) return word;
  return null;
}

/** Tags da conversa depois de a Agenda mudar o status. null = não mexe. */
export function missedTagUpdate(tags: string[], status: string): string[] | null {
  const has = tags.includes(MISSED_TAG);
  if (status === "NO_SHOW") return has ? null : [...tags, MISSED_TAG];
  return has ? tags.filter((t) => t !== MISSED_TAG) : null;
}
