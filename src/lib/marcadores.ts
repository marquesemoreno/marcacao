/** Marcadores (parceiros de marcação): pessoas e centrais que mandam pacientes pra
 * clínica. Cada um tem um link pessoal de WhatsApp com o código "#m-<codigo>" no texto
 * pré-preenchido — o webhook reconhece o código na 1ª mensagem e liga a conversa ao
 * marcador (Conversation.marcadorId). Puro: sem banco. */

/** Canal de aquisição gravado na conversa que chegou pelo link de um marcador. */
export const MARCADOR_CHANNEL = "Marcador";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** "Ailton Freitas Marcador" → "Ailton Freitas" (como vem nos contatos da clínica). */
export function cleanMarcadorName(raw: string): string {
  return raw
    .replace(/\b(marc[a-z]*d[oa]r[a]?|marc)\b\.?/gi, "")
    .replace(/\s+-\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

const ORG_WORDS = new Set(["saude", "clinica", "med", "card", "central", "lab", "sistema", "consulta", "prime", "vitta", "named", "promed", "promedcard", "conmed", "conexao", "carinho", "ja", "viver", "life"]);

/** Código curto e único pro link: primeiro nome (pessoa) ou nome inteiro colado (central). */
export function makeMarcadorCode(name: string, taken: Set<string>): string {
  const words = normalize(name).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  // Central/empresa ("Mais Saúde", "Promed Card") → nome inteiro colado; pessoa → 1º nome.
  const isOrg = words.some((w) => ORG_WORDS.has(w));
  const base = (isOrg ? words.slice(0, 2).join("") : words[0]) || "marcador";
  let code = base.slice(0, 20);
  for (let i = 2; taken.has(code); i++) code = `${base.slice(0, 18)}${i}`;
  return code;
}

/** Código do marcador no texto ("#m-lene"), ou null. */
export function extractMarcadorCode(text: string): string | null {
  const m = /#m-([a-z0-9]+)/i.exec(text);
  return m ? m[1].toLowerCase() : null;
}

export function marcadorMessage(marcador: { name: string; code: string }): string {
  return `Olá! Fui indicado(a) por ${marcador.name} (#m-${marcador.code})`;
}

/** Link pessoal: abre o WhatsApp da clínica com a mensagem que identifica o marcador. */
export function buildMarcadorLink(clinicPhone: string, marcador: { name: string; code: string }): string {
  const digits = clinicPhone.replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(marcadorMessage(marcador))}`;
}

function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 ? d : null;
}

/** Últimos 8 dígitos — casa o mesmo número com ou sem o 9º dígito. */
export function phoneTail(phone: string): string {
  return phone.replace(/\D/g, "").slice(-8);
}

/** Lista colada ("Nome – telefone", "Nome; telefone", "Nome 5577…") → cadastro, sem
 * repetir telefone. */
export function parseMarcadorList(text: string): { name: string; phone: string }[] {
  const out: { name: string; phone: string }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^(.*?)[\s;,–—-]*(\+?\(?\d[\d\s().-]{7,}\d)\s*$/.exec(line.trim());
    if (!m) continue;
    const phone = normalizePhone(m[2]);
    const name = cleanMarcadorName(m[1].replace(/[;,–—-]+\s*$/, "").trim());
    if (!phone || !name) continue;
    const tail = phoneTail(phone);
    if (seen.has(tail)) continue;
    seen.add(tail);
    out.push({ name, phone });
  }
  return out;
}

export type MarcadorRow = { id: string; name: string; referred: number; scheduled: number; attended: number; conversion: number };

/** Relatório: por marcador, pacientes indicados, quantos agendaram e quantos foram atendidos. */
export function summarizeMarcadores(
  marcadores: { id: string; name: string }[],
  referrals: { marcadorId: string; scheduled: boolean; attended: boolean }[]
): MarcadorRow[] {
  return marcadores
    .map((m) => {
      const mine = referrals.filter((r) => r.marcadorId === m.id);
      const scheduled = mine.filter((r) => r.scheduled).length;
      return {
        id: m.id,
        name: m.name,
        referred: mine.length,
        scheduled,
        attended: mine.filter((r) => r.attended).length,
        conversion: mine.length ? scheduled / mine.length : 0,
      };
    })
    .sort((a, b) => b.referred - a.referred || b.scheduled - a.scheduled || a.name.localeCompare(b.name, "pt-BR"));
}
