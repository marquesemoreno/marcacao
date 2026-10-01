/** Só formatação de EXIBIÇÃO — nunca usar isso pra gravar de volta no banco.
 * O nome cru (`Procedure.name`) inclui de propósito o sufixo "— Clínica X (Bridge)"
 * pra evitar colisão no campo @unique quando duas clínicas sincronizam um procedimento
 * de bridge com o mesmo nome (ver hospital-bridge.ts:416, `upsert` que casa por esse
 * nome composto). Desmontar isso na gravação quebraria essa sincronização. */

const BRIDGE_SUFFIX = /\s*—\s*.+\s*\(Bridge\)\s*$/i;

/** Sigla/abreviação que não deve virar Title Case — fica como está no texto de origem. */
const KEEP_AS_IS = new Set(["USG"]);

/** Palavras curtas que ficam minúsculas no meio do texto (nunca na primeira palavra). */
const LOWERCASE_CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e", "em", "com", "sem", "para", "no", "na", "ou", "a", "o"]);

/** Dicionário curado, best-effort — termos médicos/clínicos comuns que o cadastro de
 * origem (Firebird) grava sem acento, ou que chegaram com um byte corrompido (`�`,
 * U+FFFD — o caractere original já se perdeu antes de chegar aqui, não tem como
 * recuperar por algoritmo, só reconhecer a palavra inteira e substituir). Baseado nos
 * 23 nomes reais de produção conferidos nesta mudança + vocabulário óbvio da área.
 * Sem entrada aqui = fica só com o Title Case genérico (ainda legível, só sem acento).
 * Chave sempre maiúscula (comparação case-insensitive) — as com `�` são a forma
 * corrompida exata vista em produção, casam antes do fallback de limpeza no fim. */
const ACCENT_FIXUPS: Record<string, string> = {
  PROSTATA: "Próstata",
  BIOPSIA: "Biópsia",
  CONSULTORIO: "Consultório",
  "CONSULT�RIO": "Consultório",
  SAUDE: "Saúde",
  "SA�DE": "Saúde",
  CIRURGICA: "Cirúrgica",
  PEDIATRICA: "Pediátrica",
  UROLOGIA: "Urologia",
  GINECOLOGIA: "Ginecologia",
  PROCTOLOGIA: "Proctologia",
  URODINAMICA: "Urodinâmica",
  ELETROCOAGULACAO: "Eletrocoagulação",
  EXERESE: "Exérese",
  REVISAO: "Revisão",
  LESAO: "Lesão",
  LESOES: "Lesões",
  HORARIO: "Horário",
  PRE: "Pré",
  ATE: "até",
};

const bareWordPattern = /[^\wÀ-ÿ�]/g;

function titleCaseWord(word: string, isFirstWord: boolean): string {
  const bare = word.replace(bareWordPattern, "");
  if (!bare) return word;

  const fixup = ACCENT_FIXUPS[bare.toUpperCase()];
  if (fixup) {
    const cased = isFirstWord ? fixup[0].toUpperCase() + fixup.slice(1) : fixup;
    return word.replace(bare, cased);
  }

  if (KEEP_AS_IS.has(bare.toUpperCase())) return word;

  if (!isFirstWord && LOWERCASE_CONNECTORS.has(bare.toLowerCase())) {
    return word.replace(bare, bare.toLowerCase());
  }

  const capitalized = bare[0].toUpperCase() + bare.slice(1).toLowerCase();
  return word.replace(bare, capitalized);
}

/** Nome do procedimento pra exibir na UI — remove o sufixo de Bridge, converte de
 * ALL CAPS pra Title Case (com pequenas exceções em português) e aplica o dicionário
 * de acentos best-effort. Idempotente: nome já formatado ou sem sufixo passa
 * praticamente inalterado. */
export function formatProcedureName(rawName: string): string {
  const withoutSuffix = rawName.replace(BRIDGE_SUFFIX, "").trim().replace(/\s{2,}/g, " ");
  if (!withoutSuffix) return withoutSuffix;

  const titled = withoutSuffix
    .split(" ")
    .map((word, index) => titleCaseWord(word, index === 0))
    .join(" ");

  // Fallback: qualquer � que sobrou (palavra sem entrada no dicionário) — remove em
  // vez de mostrar o glyph quebrado, mesmo não sendo uma recuperação de verdade.
  return titled.replace(/�/g, "").replace(/\s{2,}/g, " ").trim();
}
