/** Convênios aceitos respondidos sozinhos (roteiro, Etapa 2.7). "Vocês aceitam Unimed?" era uma
 * das perguntas mais repetidas (Santa Clara: 168 conversas em 60 dias). A clínica cadastra a
 * lista em Ações da IA; a resposta é montada aqui, sem modelo de linguagem — só o que a clínica
 * escreveu. Puro e testado; quem chama é o webhook do WhatsApp. */

/** Toda resposta começa assim: é como o webhook acha a última enviada na conversa. */
export const INSURANCE_REPLY_PREFIX = "🏥 ";
const REPEAT_MS = 12 * 3_600_000;
const MAX_ITEMS = 60;
const MAX_NAME = 60;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convênios comuns, para reconhecer um que a clínica NÃO atende e dizer isso com clareza.
 * [nome exibido, apelidos normalizados]. */
const KNOWN: [string, string[]][] = [
  ["Unimed", ["unimed"]],
  ["Bradesco Saúde", ["bradesco saude", "bradesco"]],
  ["SulAmérica", ["sulamerica", "sul america"]],
  ["Amil", ["amil"]],
  ["Hapvida", ["hapvida", "hap vida"]],
  ["NotreDame Intermédica", ["notredame", "notre dame", "intermedica", "gndi"]],
  ["Cassi", ["cassi"]],
  ["Geap", ["geap"]],
  ["Planserv", ["planserv"]],
  ["Petrobras", ["petrobras", "ams petrobras"]],
  ["Postal Saúde", ["postal saude"]],
  ["Saúde Caixa", ["saude caixa"]],
  ["Porto Seguro", ["porto seguro", "porto saude"]],
  ["Golden Cross", ["golden cross"]],
  ["Prevent Senior", ["prevent senior"]],
  ["Cabesp", ["cabesp"]],
  ["Camed", ["camed"]],
  ["Assefaz", ["assefaz"]],
  ["Fusex", ["fusex"]],
  ["Ipasgo", ["ipasgo"]],
  ["Mediservice", ["mediservice"]],
  ["Promédica", ["promedica"]],
  ["São Francisco", ["sao francisco saude"]],
  ["Vitallis", ["vitallis"]],
  ["Care Plus", ["care plus", "careplus"]],
  ["Omint", ["omint"]],
  ["Allianz", ["allianz"]],
  ["Life Empresarial", ["life empresarial"]],
];

const hasWord = (text: string, phrase: string) => new RegExp(`(^| )${phrase}( |$)`).test(text);

/** Palavras que não identificam convênio nenhum ("Saúde" em "Bradesco Saúde"). */
const GENERIC = new Set(["saude", "plano", "planos", "convenio", "convenios", "seguro", "seguros", "assistencia", "medica", "de", "da", "do"]);

/** Apelidos de um nome cadastrado pela clínica: o nome inteiro e a primeira palavra própria. */
function aliasesOf(name: string): string[] {
  const full = norm(name);
  const firstOwn = full.split(" ").find((w) => w.length >= 4 && !GENERIC.has(w));
  return [...new Set([full, firstOwn].filter((a): a is string => !!a))];
}

/** Convênio citado na mensagem: primeiro entre os que a clínica atende, depois entre os conhecidos. */
export function findMentionedInsurance(message: string, accepted: string[]): { name: string; accepted: boolean } | null {
  const text = norm(message);
  for (const name of accepted) {
    if (aliasesOf(name).some((a) => hasWord(text, a))) return { name, accepted: true };
  }
  for (const [name, aliases] of KNOWN) {
    if (aliases.some((a) => hasWord(text, a))) return { name, accepted: false };
  }
  return null;
}

const ASK =
  /\b(aceita|aceitam|aceitao|atende|atendem|atendemos|trabalha|trabalham|recebe|recebem|pega|pegam|tem|possui|possuem|quais|qual|cobre|cobrem)\b/;
const TOPIC = /\b(convenio|convenios|plano|planos|plano de saude|carteirinha)\b/;
/** Acompanhamento de autorização/guia é assunto da recepção, não de lista de convênios. */
const FOLLOW_UP = /\b(autoriz\w*|guia|guias|liberad\w*|liberou|liberacao|senha|carteirinha|boleto|reembolso|nota fiscal)\b/;
/** Paciente informando o dele ("meu convênio é X"), não perguntando. */
const STATING = /\b(meu|minha|o meu|a minha) (convenio|plano)\b|\b(convenio|plano) (e|eh) \b/;

export function isInsuranceQuestion(message: string): boolean {
  const text = norm(message);
  if (!text || text.length > 140) return false;
  if (FOLLOW_UP.test(text) || STATING.test(text)) return false;
  const mentionsInsurer = KNOWN.some(([, aliases]) => aliases.some((a) => hasWord(text, a)));
  // "é pelo plano ou só particular?"
  if (/\b(pelo|com|por) (plano|convenio)\b/.test(text) && /\bparticular\b/.test(text)) return true;
  if (!ASK.test(text)) return false;
  return TOPIC.test(text) || mentionsInsurer;
}

function listText(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function insuranceReply(input: { accepted: string[]; mentioned: { name: string; accepted: boolean } | null; note: string }): string {
  const list = `Convênios que atendemos: ${listText(input.accepted)}.`;
  const body = !input.mentioned
    ? list
    : input.mentioned.accepted
      ? `Atendemos sim pelo convênio ${input.mentioned.name}.`
      : `No momento não atendemos pelo convênio ${input.mentioned.name}.\n\n${list}`;
  const note = input.note.trim();
  return `${INSURANCE_REPLY_PREFIX}${body}${note ? `\n\n${note}` : ""}`;
}

export function shouldSendInsuranceReply(input: { enabled: boolean; accepted: string[]; message: string; lastReplyAt: Date | null; now: Date }): boolean {
  if (!input.enabled || input.accepted.length === 0 || !isInsuranceQuestion(input.message)) return false;
  return !input.lastReplyAt || input.now.getTime() - input.lastReplyAt.getTime() >= REPEAT_MS;
}

/** Texto da tela (um por linha ou separado por vírgula) → lista limpa. */
export function parseInsuranceList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const name = part.trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
    const key = norm(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
