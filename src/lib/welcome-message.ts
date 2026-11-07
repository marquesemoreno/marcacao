/** Saudação ampliada + endereço automático (Etapa 2.3, 07/11/2026). As atendentes digitavam
 * "Bom dia, em que posso ajudar?" e o endereço centenas de vezes por mês. Puro e testado. */
import { greetingFirstName } from "./format";

const RETURN_GAP_MS = 6 * 3_600_000;
const ADDRESS_REPEAT_MS = 12 * 3_600_000;

/** Primeiro contato, ou volta depois de atendimento finalizado há 6 h ou mais. */
export function shouldSendWelcome(input: {
  enabled: boolean;
  text: string | null | undefined;
  isNewConversation: boolean;
  previousStatus: string | null;
  previousLastMessageAt: Date | null;
  now: Date;
}): boolean {
  if (!input.enabled || !input.text?.trim()) return false;
  if (input.isNewConversation) return true;
  if (input.previousStatus !== "RESOLVED" || !input.previousLastMessageAt) return false;
  return input.now.getTime() - input.previousLastMessageAt.getTime() >= RETURN_GAP_MS;
}

function brHour(d: Date): number {
  return new Date(d.getTime() - 3 * 3_600_000).getUTCHours();
}

export function timeGreeting(now: Date): string {
  const h = brHour(now);
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

/** {{saudacao}} → Bom dia/Boa tarde/Boa noite; {{nome}} → primeiro nome (some se for número). */
export function renderWelcome(text: string, ctx: { name: string; now: Date }): string {
  const first = /^\+?\d/.test(ctx.name.trim()) ? "" : greetingFirstName(ctx.name);
  let out = text.replace(/\{\{\s*saudacao\s*\}\}/gi, timeGreeting(ctx.now));
  out = first ? out.replace(/\{\{\s*nome\s*\}\}/gi, first) : out.replace(/,?\s*\{\{\s*nome\s*\}\}/gi, "");
  return out.trim();
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const ADDRESS_PATTERNS = [
  /\bonde (fica|ficam|e|esta|estao|voces|vcs)\b(?!.*\b(resultado|exame|laudo|pego|pegar|retiro|retirar)\b)/,
  /\b(voces|vcs|voce|vc|clinica) (fica|ficam|esta|estao) onde\b/,
  /\bendere[cç]o\b/,
  /\blocaliza[cç][aã]o\b/,
  /\bcomo (faco|fa[cç]o)? ?(pra|para)? ?cheg/,
  /\bcomo cheg/,
  /\bqual (a )?rua\b/,
  /\bponto de referencia\b/,
];

export function isAddressQuestion(message: string): boolean {
  const t = norm(message).trim();
  // Mensagem longa = formulário, anúncio, fornecedor; "endereço:" = paciente informando o dele.
  if (t.length > 140 || /endere[cç]o\s*:|:\s*endere[cç]o|nota fiscal|pix/.test(t)) return false;
  return ADDRESS_PATTERNS.some((re) => re.test(t));
}

export function addressReply(clinic: { address: string; neighborhood?: string | null; city?: string | null }): string {
  const line = [clinic.address, clinic.neighborhood].filter(Boolean).join(" - ") + (clinic.city ? `, ${clinic.city}` : "");
  const query = encodeURIComponent([clinic.address, clinic.neighborhood, clinic.city].filter(Boolean).join(", "));
  return `📍 Nosso endereço: ${line}\n\nMapa: https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function shouldSendAddressReply(input: { enabled: boolean; message: string; lastAddressReplyAt: Date | null; now: Date }): boolean {
  if (!input.enabled || !isAddressQuestion(input.message)) return false;
  return !input.lastAddressReplyAt || input.now.getTime() - input.lastAddressReplyAt.getTime() >= ADDRESS_REPEAT_MS;
}
