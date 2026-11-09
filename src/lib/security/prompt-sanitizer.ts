import { isValidCpf } from "@/lib/cpf";

/**
 * Barreira LGPD entre os dados do paciente e os modelos de IA (09/11/2026).
 *
 * Pseudonimização reversível: antes de qualquer texto ir para um modelo, troca o que
 * identifica a pessoa por tokens `{{PATIENT_<TIPO>_<n>}}`; o que volta do modelo é
 * restaurado na borda (`restore`). O mapa token → valor vive só nesta instância, em
 * memória, durante a requisição — nunca vai para disco, log, banco ou para o modelo.
 *
 * Uma instância por chamada de IA: o mesmo valor em mensagens diferentes vira o mesmo
 * token, então o modelo entende que é a mesma pessoa.
 *
 * O CONTEÚDO de saúde (sintomas, exames) continua indo — sem ele a IA não ajuda. A
 * barreira tira QUEM é a pessoa, não O QUE ela disse.
 */

export type MaskCategory = "NAME" | "CPF" | "EMAIL" | "PHONE" | "DATE" | "ID" | "CEP" | "ADDRESS";

export interface PromptSanitizerOptions {
  /** Nomes que já sabemos ser do paciente/responsável (cadastro). */
  knownNames?: (string | null | undefined)[];
  /** Termos que NÃO podem ser mascarados (nome da clínica, do médico…). */
  preserveTerms?: (string | null | undefined)[];
  /** Relógio (testes). Datas com 3+ anos são tratadas como data de nascimento. */
  now?: Date;
}

const L = "\\p{L}\\p{N}";
const NOT_BEFORE = `(?<![${L}])`;
const NOT_AFTER = `(?![${L}])`;

const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}\b/g;
const PHONE_PATTERN = /(?<![\d{_])(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;
const CEP_KEYWORD_PATTERN = /(\bCEP\b[:\s]*)(\d{5}-?\d{3})(?!\d)/gi;
const CEP_BARE_PATTERN = /(?<![\d-])\d{5}-\d{3}(?![\d-])/g;
const ID_KEYWORD_PATTERN = new RegExp(
  `(${NOT_BEFORE}(?:RG|CNS|carteirinha|carteira(?: do (?:plano|conv[eê]nio))?|cart[aã]o(?: do)? (?:SUS|conv[eê]nio|plano)|matr[ií]cula)${NOT_AFTER}[:\\s]*(?:n[º°o]\\.?\\s*)?)(\\d[\\d.\\s/-]{2,28}\\d|\\d{4,})`,
  "giu",
);
const LONG_DIGITS_PATTERN = /(?<![\d{_])\d{15,}(?!\d)/g;
const DATE_PATTERN = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/g;
const ADDRESS_PATTERN = new RegExp(
  `${NOT_BEFORE}(?:rua|avenida|av\\.?|travessa|alameda|rodovia|pra[çc]a|estrada|loteamento|condom[ií]nio)\\s+[^\\n,;:]{2,60}?,?\\s*(?:n[º°o]\\.?\\s*)?\\d{1,5}${NOT_AFTER}`,
  "giu",
);
const NAME_WORD = "\\p{Lu}\\p{Ll}+";
const SELF_INTRO_PATTERN = new RegExp(
  `((?:[Mm]eu nome [ée]|[Mm]e chamo|[Aa]qui [ée](?: [ao])?|[Ss]ou [ao])\\s+)(${NAME_WORD}(?:\\s+(?:(?:d[aeo]s?|e)\\s+)?${NAME_WORD}){0,4})`,
  "gu",
);
const TOKEN_LOOSE_PATTERN = /\{{0,2}PATIENT_([A-Z]+)_(\d+)\}{0,2}/g;

const ACCENTS: Record<string, string> = {
  a: "aáàâãä",
  e: "eéèêë",
  i: "iíìîï",
  o: "oóòôõö",
  u: "uúùûü",
  c: "cç",
  n: "nñ",
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegex(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex de um nome que ignora acento e maiúscula ("otavio" casa com "Otávio"). */
function accentInsensitivePattern(value: string): string {
  return [...normalize(value)]
    .map((ch) => (ch === " " ? "\\s+" : ACCENTS[ch] ? `[${ACCENTS[ch]}]` : escapeRegex(ch)))
    .join("");
}

export class PromptSanitizer {
  private readonly vault = new Map<string, string>();
  private readonly valueToToken = new Map<string, string>();
  private readonly counters = new Map<MaskCategory, number>();
  private readonly names = new Set<string>();
  private readonly preserveTerms: string[];
  private readonly birthYearLimit: number;

  constructor(options: PromptSanitizerOptions = {}) {
    for (const name of options.knownNames ?? []) this.addName(name);
    this.preserveTerms = (options.preserveTerms ?? [])
      .map((t) => t?.trim() ?? "")
      .filter((t) => t.length >= 3)
      .sort((a, b) => b.length - a.length);
    this.birthYearLimit = (options.now ?? new Date()).getFullYear() - 3;
  }

  /** Mascara um texto. Pode ser chamado várias vezes (uma por mensagem). */
  mask(text: string): string {
    if (!text) return text;
    const preserved: string[] = [];
    let out = text;
    for (const term of this.preserveTerms) {
      out = out.replace(new RegExp(accentInsensitivePattern(term), "giu"), (m) => {
        preserved.push(m);
        return `${preserved.length - 1}`;
      });
    }

    out = out.replace(CPF_PATTERN, (m) => (isValidCpf(m) ? this.token("CPF", m) : m));
    out = out.replace(EMAIL_PATTERN, (m) => this.token("EMAIL", m));
    out = out.replace(CEP_KEYWORD_PATTERN, (_m, prefix: string, cep: string) => prefix + this.token("CEP", cep));
    out = out.replace(CEP_BARE_PATTERN, (m) => this.token("CEP", m));
    out = out.replace(ID_KEYWORD_PATTERN, (_m, prefix: string, id: string) => prefix + this.token("ID", id.trim()));
    out = out.replace(LONG_DIGITS_PATTERN, (m) => this.token("ID", m));
    out = out.replace(PHONE_PATTERN, (m) => {
      const digits = m.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 13 ? this.token("PHONE", m) : m;
    });
    out = out.replace(DATE_PATTERN, (m, d: string, mo: string, y: string) => {
      const day = Number(d);
      const month = Number(mo);
      const year = Number(y);
      const plausible = day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900;
      return plausible && year <= this.birthYearLimit ? this.token("DATE", m) : m;
    });
    out = out.replace(ADDRESS_PATTERN, (m) => this.token("ADDRESS", m));
    out = out.replace(SELF_INTRO_PATTERN, (_m, prefix: string, name: string) => {
      this.addName(name);
      return prefix + this.token("NAME", name);
    });
    out = this.maskNames(out);

    return out.replace(/(\d+)/g, (_m, i: string) => preserved[Number(i)] ?? "");
  }

  /** Troca os tokens (inclusive escritos sem as chaves pela IA) pelos valores reais. */
  restore(text: string): string {
    if (!text || this.vault.size === 0) return text;
    return text.replace(TOKEN_LOOSE_PATTERN, (m, cat: string, n: string) => this.vault.get(`{{PATIENT_${cat}_${n}}}`) ?? m);
  }

  /** Quantos valores distintos de cada tipo foram mascarados (para o registro, sem o conteúdo). */
  counts(): Partial<Record<MaskCategory, number>> {
    return Object.fromEntries(this.counters) as Partial<Record<MaskCategory, number>>;
  }

  get size(): number {
    return this.vault.size;
  }

  private addName(name: string | null | undefined) {
    const clean = name?.replace(/\s+/g, " ").trim();
    if (clean && clean.length >= 3) this.names.add(clean);
  }

  private maskNames(text: string): string {
    const full = [...this.names].sort((a, b) => b.length - a.length);
    let out = text;
    for (const name of full) {
      const re = new RegExp(`${NOT_BEFORE}${accentInsensitivePattern(name)}${NOT_AFTER}`, "giu");
      out = out.replace(re, (m) => this.token("NAME", m));
    }
    const firstNames = new Set(full.map((n) => n.split(" ")[0]).filter((f) => f.length >= 3));
    for (const first of firstNames) {
      const re = new RegExp(`${NOT_BEFORE}${accentInsensitivePattern(first)}${NOT_AFTER}`, "giu");
      // Primeiro nome sozinho só com inicial maiúscula ("Rosa" sim, "rosa" não).
      out = out.replace(re, (m) => (m[0] === m[0].toLocaleUpperCase("pt-BR") ? this.token("NAME", m) : m));
    }
    return out;
  }

  private token(category: MaskCategory, raw: string): string {
    const key = `${category}:${normalize(raw)}`;
    const existing = this.valueToToken.get(key);
    if (existing) return existing;
    const n = (this.counters.get(category) ?? 0) + 1;
    this.counters.set(category, n);
    const token = `{{PATIENT_${category}_${n}}}`;
    this.valueToToken.set(key, token);
    this.vault.set(token, raw.trim());
    return token;
  }
}
