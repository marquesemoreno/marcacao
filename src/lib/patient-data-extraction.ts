/** Dados do paciente que aparecem soltos na conversa (CPF, convênio) — viram uma SUGESTÃO
 * na ficha para a atendente confirmar, nunca são gravados no cadastro sozinhos. Puro. */

export function isValidCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

function formatCpf(d: string) {
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Nome padrão + como aparece no texto (já sem acento e minúsculo). */
const CONVENIOS: { name: string; match: string }[] = [
  { name: "Unimed", match: "unimed" },
  { name: "Bradesco Saúde", match: "bradesco saude" },
  { name: "SulAmérica", match: "sulamerica" },
  { name: "Amil", match: "amil" },
  { name: "Hapvida", match: "hapvida" },
  { name: "NotreDame Intermédica", match: "notredame" },
  { name: "Porto Seguro", match: "porto seguro" },
  { name: "Cassi", match: "cassi" },
  { name: "Geap", match: "geap" },
  { name: "Postal Saúde", match: "postal saude" },
];

const NEGATIONS = new Set(["nao", "sem"]);

function plain(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function extractPatientData(text: string): { cpf?: string; convenio?: string } {
  const out: { cpf?: string; convenio?: string } = {};

  for (const m of text.matchAll(/(?<!\d)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)/g)) {
    if (isValidCpf(m[1])) {
      out.cpf = formatCpf(m[1].replace(/\D/g, ""));
      break;
    }
  }

  const normalized = plain(text);
  for (const c of CONVENIOS) {
    const hit = new RegExp(`(?<![a-z])${c.match}(?![a-z])`).exec(normalized);
    if (!hit) continue;
    const before = normalized.slice(0, hit.index).match(/[a-z]+/g)?.slice(-3) ?? [];
    if (before.some((w) => NEGATIONS.has(w))) continue;
    out.convenio = c.name;
    break;
  }

  return out;
}
