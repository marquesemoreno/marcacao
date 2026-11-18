/**
 * Trava de afirmação clínica na saída da IA (análise do DeskcommCRM, 18/11/2026).
 *
 * A regra 2 do prompt do atendente (ai-attendant.ts) já proíbe diagnóstico e prescrição,
 * mas prompt não garante nada: o modelo pode escorregar. Esta função confere o TEXTO
 * que vai sair, antes de ir para o paciente — sem chamar IA, sem custo, por frases.
 *
 * Barra cinco tipos de afirmação (CFM — só o médico avalia):
 *  - DIAGNOSTICO: "você tem cálculo renal", "isso parece prostatite"
 *  - MEDICACAO:   "pode tomar dipirona", "500 mg de 8 em 8 horas"
 *  - PROMESSA:    "resultado garantido", "100% de sucesso", "sem nenhum risco"
 *  - GRAVIDADE:   "não é câncer", "deve ser benigno", "não é nada grave"
 *  - EXAME:       "seu exame está normal", "o PSA deu alto"
 *
 * Sempre ligada (produto de clínica), sem interruptor. Erra para o lado de barrar:
 * um falso positivo só custa uma reescrita (ou passar a conversa para a recepção).
 */

export type ClinicalClaimReason = "DIAGNOSTICO" | "MEDICACAO" | "PROMESSA" | "GRAVIDADE" | "EXAME";

export type ClinicalClaimCheck = { blocked: false; reason: null } | { blocked: true; reason: ClinicalClaimReason };

export const CLINICAL_CLAIM_LABELS: Record<ClinicalClaimReason, string> = {
  DIAGNOSTICO: "diagnóstico",
  MEDICACAO: "indicação de remédio ou dose",
  PROMESSA: "promessa de resultado",
  GRAVIDADE: "afirmação sobre gravidade ou câncer",
  EXAME: "interpretação de exame",
};

/** minúsculas, sem acento, espaços normais — os padrões abaixo são escritos assim. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------- diagnóstico

const CONDITIONS = new Set([
  "calculo", "calculos", "pedra", "pedras", "infeccao", "cistite", "prostatite", "uretrite",
  "hiperplasia", "cancer", "tumor", "cisto", "nodulo", "hernia", "varicocele", "hidrocele",
  "fimose", "diabetes", "hipertensao", "gastrite", "sinusite", "virose", "dengue", "covid",
  "gripe", "pneumonia", "anemia", "ansiedade", "depressao", "inflamacao", "alergia", "fratura",
  "tendinite", "artrose", "artrite", "enxaqueca", "catarata", "glaucoma", "candidiase", "hpv",
  "ist", "dst", "incontinencia", "endometriose", "mioma", "refluxo", "colica", "litiase",
  "insuficiencia", "infarto", "avc", "trombose", "labirintite", "bursite", "hemorroida",
  "hemorroidas", "micose", "herpes", "sifilis", "gonorreia", "clamidia", "epididimite",
]);
const TWO_WORD_CONDITIONS = new Set(["pressao alta", "pressao baixa", "disfuncao eretil"]);
/** Palavras comuns que terminam como doença (-ite, -ose, -oma) mas não são. */
const SUFFIX_STOPLIST = new Set([
  "limite", "convite", "palpite", "apetite", "acredite", "permite", "admite", "transmite",
  "emite", "evite", "visite", "aceite", "deleite", "dose", "toma", "soma", "roma", "idioma",
  "diploma", "aroma", "sintoma", "sintomas", "glicose",
]);

function isClinicalTerm(firstWord: string, secondWord: string | undefined): boolean {
  if (secondWord && TWO_WORD_CONDITIONS.has(`${firstWord} ${secondWord}`)) return true;
  if (CONDITIONS.has(firstWord)) return true;
  if (SUFFIX_STOPLIST.has(firstWord)) return false;
  return /^[a-z]{3,}(ite|ites|ose|oses|oma|omas)$/.test(firstWord);
}

const ARTICLE = "(?:um |uma |uns |umas |o |a |os |as |de |de um |de uma )?";
const TERM = "([a-z-]+)(?: ([a-z-]+))?";

const DIAGNOSIS_PATTERNS: RegExp[] = [
  // "você tem cálculo", "o senhor deve ter uma hérnia", "você está com infecção"
  new RegExp(
    "\\b(?:voce|vc|o senhor|a senhora|ele|ela|seu filho|sua filha|seu pai|sua mae|seu marido|sua esposa)" +
      " (?:provavelmente |com certeza |certamente )?" +
      "(?:tem|esta com|deve ter|deve estar com|pode ter|pode estar com|parece ter|parece estar com|esta tendo)" +
      ` ${ARTICLE}${TERM}`,
    "g"
  ),
  // "isso parece ser prostatite", "esses sintomas indicam sinusite", "provavelmente é gastrite"
  new RegExp(
    "\\b(?:isso|isto|esse quadro|esse sintoma|esses sintomas|seu caso|o seu caso|o que voce tem|provavelmente|com certeza|certamente|pelo visto)" +
      // alternativas mais longas primeiro: "parece" casaria antes de "parece ser" e o termo viraria "ser"
      " (?:parece ser|deve ser|pode ser|sao de|e de|e|eh|parece|indicam|indica|sugerem|sugere|seria|sao)" +
      ` ${ARTICLE}${TERM}`,
    "g"
  ),
];
const DIAGNOSIS_DIRECT = /\b(?:seu|o seu|o) diagnostico (?:e|eh|seria|provavel)\b/;

function hasDiagnosis(t: string): boolean {
  if (DIAGNOSIS_DIRECT.test(t)) return true;
  for (const pattern of DIAGNOSIS_PATTERNS) {
    for (const match of t.matchAll(pattern)) {
      if (isClinicalTerm(match[1], match[2])) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- gravidade

const GRAVITY_PATTERNS: RegExp[] = [
  // "não é câncer", "deve ser benigno", "parece um tumor" — mas não "dizer se é câncer"
  /(?<!\bse )\b(?:e|eh|parece|parece ser|deve ser|pode ser|seria|nao e|nao eh|nao parece|nao deve ser)\s(?:um |uma )?(?:cancer|tumor|maligno|maligna|benigno|benigna)\b/,
  /\bnao (?:e|eh|deve ser|parece|parece ser) nada (?:grave|serio|preocupante|demais)\b/,
];

// ---------------------------------------------------------------- medicação

const MEDS =
  "(?:remedio|remedios|medicamento|medicamentos|medicacao|comprimido|comprimidos|capsula|capsulas|pomada|creme|" +
  "antibiotico|anti-inflamatorio|antiinflamatorio|analgesico|relaxante muscular|dipirona|paracetamol|ibuprofeno|" +
  "nimesulida|amoxicilina|azitromicina|cefalexina|ciprofloxacino|nitrofurantoina|fosfomicina|buscopan|tansulosina|" +
  "sildenafila|tadalafila|omeprazol|dorflex|novalgina|tylenol|diclofenaco|cetoprofeno|prednisona|corticoide)\\b";
const MED_ARTICLE = "(?:o |a |um |uma |uns |umas |de |)";
const MEDICATION_PATTERNS: RegExp[] = [
  new RegExp(`\\b(?:tome|tomar|use|usar|passe|passar|aplique|aplicar|receito|prescrevo|recomendo|indico|sugiro) ${MED_ARTICLE}${MEDS}`),
  new RegExp(`\\b(?:recomendo|indico|sugiro|aconselho) (?:tomar|usar|passar|aplicar) ${MED_ARTICLE}${MEDS}`),
  /\b\d+(?:[.,]\d+)? ?(?:mg|mcg)\b/,
  /\b\d+ (?:gotas|comprimidos?|capsulas?)\b/,
  /\bde \d+ em \d+ horas\b/,
  /\ba cada \d+ horas\b/,
];

// ---------------------------------------------------------------- promessa

const PROMISE_PATTERNS: RegExp[] = [
  /\bgarant(?:o|imos|e|em|ido|ida)\s(?:o |a |)(?:resultado|cura|sucesso)\b/,
  /\bresultados? (?:e |eh |sao |)garantid[oa]s?\b/,
  /\b100 ?% (?:de )?(?:sucesso|cura|garantid|eficaz|eficacia|resolvid)/,
  /\b(?:vai|vao|ira|irao) (?:te |lhe )?curar\b/,
  /\bcura (?:definitiva|garantida|total)\b/,
  /\bsem (?:nenhum |qualquer )?risco\b/,
  /\b(?:nao tem|nao ha|zero) (?:nenhum |qualquer )?risco\b/,
];

// ---------------------------------------------------------------- exame

const EXAM_PATTERN =
  /\b(?:seu|o seu|sua|o|a) (?:exame|resultado|psa|ultrassom|ultrassonografia|tomografia|ressonancia|hemograma|laudo|glicemia|colesterol|biopsia)(?: do exame| do psa)? (?:esta|deu|veio|ficou|parece|e|eh) (?:normal|alterado|alterada|alto|alta|baixo|baixa|bom|boa|otimo|otima|ruim|limpo|limpa|tranquilo|ok|negativo|positivo|preocupante)\b/;

export function checkClinicalClaim(text: string): ClinicalClaimCheck {
  const t = normalize(text);
  if (!t.trim()) return { blocked: false, reason: null };
  if (hasDiagnosis(t)) return { blocked: true, reason: "DIAGNOSTICO" };
  if (GRAVITY_PATTERNS.some((p) => p.test(t))) return { blocked: true, reason: "GRAVIDADE" };
  if (MEDICATION_PATTERNS.some((p) => p.test(t))) return { blocked: true, reason: "MEDICACAO" };
  if (PROMISE_PATTERNS.some((p) => p.test(t))) return { blocked: true, reason: "PROMESSA" };
  if (EXAM_PATTERN.test(t)) return { blocked: true, reason: "EXAME" };
  return { blocked: false, reason: null };
}

export function clinicalRewriteInstruction(reason: ClinicalClaimReason): string {
  return (
    `Sua resposta anterior NÃO foi enviada porque continha ${CLINICAL_CLAIM_LABELS[reason]}. ` +
    "Reescreva sem dizer o que o paciente tem, sem indicar remédio ou dose, sem prometer resultado, " +
    "sem falar de gravidade e sem interpretar exame. Diga que só o médico pode avaliar isso e ofereça marcar uma consulta."
  );
}

export type ClinicalGuardResult = {
  /** Texto que pode sair para o paciente; null = não enviar nada (passar para humano). */
  text: string | null;
  /** Motivo da 1ª resposta ter sido barrada (null = passou de primeira). */
  firstBlock: ClinicalClaimReason | null;
  /** Motivo da reescrita também ter sido barrada (null = saiu algo limpo). */
  finalBlock: ClinicalClaimReason | null;
};

/** Confere a resposta; se barrada, pede UMA reescrita ao modelo. Se a reescrita também
 * for barrada (ou falhar), devolve text=null — quem chama passa a conversa para a equipe. */
export async function enforceClinicalGuard(
  reply: string,
  rewrite: (instruction: string) => Promise<string | null>
): Promise<ClinicalGuardResult> {
  const first = checkClinicalClaim(reply);
  if (!first.blocked) return { text: reply, firstBlock: null, finalBlock: null };

  const rewritten = await rewrite(clinicalRewriteInstruction(first.reason));
  if (!rewritten) return { text: null, firstBlock: first.reason, finalBlock: first.reason };
  const second = checkClinicalClaim(rewritten);
  if (second.blocked) return { text: null, firstBlock: first.reason, finalBlock: second.reason };
  return { text: rewritten, firstBlock: first.reason, finalBlock: null };
}
