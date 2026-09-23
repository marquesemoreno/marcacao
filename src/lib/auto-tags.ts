import { PROCEDURE_INTEREST_TAG_PREFIX, MARKETPLACE_SOURCE_TAG } from "@/lib/conversation-tags";

/** Mesma lista de palavras-chave de src/actions/chatbot.ts (extractProcedureKeyword) —
 * copiada aqui de propósito em vez de importada: aquele arquivo mistura detecção com
 * envio de mensagem automática e mudança de funil, e não queremos acoplar a essas
 * outras coisas (nem ligar a função de lá, que continua nunca-chamada). */
const PROCEDURE_KEYWORDS = [
  "consulta",
  "ultrassom",
  "exame",
  "ecocardiograma",
  "ginecologia",
  "urologia",
  "hemograma",
  "raio-x",
  "tomografia",
  "ressonância",
  "sangue",
  "cardiologia",
  "ortopedia",
  "dermatologia",
  "endocrinologia",
  "pediatria",
  "checkup",
  "jejum",
];

/** Detecta menção a um procedimento na mensagem do paciente — pura, sem banco, sem
 * `server-only`, pra poder testar (ver auto-tags.test.ts). `null` quando nenhuma
 * palavra-chave bate. */
export function detectProcedureInterestTag(text: string): string | null {
  const lower = text.toLowerCase();
  const match = PROCEDURE_KEYWORDS.find((kw) => lower.includes(kw));
  if (!match) return null;
  const label = match.charAt(0).toUpperCase() + match.slice(1);
  return `${PROCEDURE_INTEREST_TAG_PREFIX}${label}`;
}

/** Detecta a origem do primeiro contato só quando o paciente manda, sem editar, o
 * texto pré-preenchido do link de WhatsApp de /clinicas (único CTA do site hoje com
 * texto distinto o bastante pra reconhecer) — melhor esforço, `null` quando não
 * reconhece nada (nunca bloqueia, nunca "adivinha"). */
export function detectSourceTag(text: string): string | null {
  // Texto de src/app/(public)/clinicas/page.tsx:156 — link de WhatsApp do marketplace de clínicas.
  if (text.includes("no Conecta Saúde")) return MARKETPLACE_SOURCE_TAG;
  return null;
}
