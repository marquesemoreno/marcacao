import "server-only";
import { prisma } from "@/lib/prisma";
import type { ExtractedDocument } from "@/lib/documents/document-processor";
import { levenshteinSimilarity, tierFor, type ConfidenceTier } from "@/lib/documents/levenshtein";

/**
 * Validação determinística do que a IA extraiu — nunca deixa a IA "confirmar"
 * um procedimento ou convênio sozinha. Reconcilia proceduresFound contra o
 * catálogo REAL desta clínica (fuzzy match via levenshteinSimilarity, ver
 * levenshtein.ts) e calcula um score de confiança.
 */

// `type` (não `interface`) de propósito — precisa ser estruturalmente compatível
// com o Json de entrada do Prisma (DocumentReviewData é gravado em
// Message.extractedDocumentData), e `interface` não satisfaz a checagem de
// índice implícita que o Prisma exige pra InputJsonValue (mesmo motivo de
// InvoiceData, em chat-messages.ts, já ser `type`).
export type ProcedureMatch = {
  rawText: string;
  matched: { clinicProcedureId: string; procedureName: string; similarity: number } | null;
};

export type ConfidenceBreakdown = {
  catalogMatchScore: number; // 0-40
  convenioScore: number; // 0-30
  legibilityScore: number; // 0-30
  total: number; // 0-100
  tier: ConfidenceTier;
};

export type DocumentValidationResult = {
  procedureMatches: ProcedureMatch[];
  convenioMatch: { identified: string | null; recognizedAsKnown: boolean };
  confidence: ConfidenceBreakdown;
};

export type DocumentReviewData = {
  extracted: ExtractedDocument;
  validation: DocumentValidationResult;
};

const MATCH_THRESHOLD = 0.8;

function matchProceduresAgainstCatalog(
  proceduresFound: string[],
  catalog: { clinicProcedureId: string; procedureName: string }[]
): ProcedureMatch[] {
  return proceduresFound.map((rawText) => {
    let best: { clinicProcedureId: string; procedureName: string; similarity: number } | null = null;
    for (const item of catalog) {
      const similarity = levenshteinSimilarity(rawText, item.procedureName);
      if (similarity >= MATCH_THRESHOLD && (!best || similarity > best.similarity)) {
        best = { clinicProcedureId: item.clinicProcedureId, procedureName: item.procedureName, similarity };
      }
    }
    return { rawText, matched: best };
  });
}

/** Não existe `model Convenio`/FK em lugar nenhum do schema (confirmado antes de
 * codificar) — `Contact.convenio` é texto livre de propósito. O único dado
 * estruturado por clínica relacionado é `ClinicKnowledgeEntry` (categoria
 * CONVENIOS, texto livre também). Então isso é necessariamente um fuzzy-match
 * de texto, não uma checagem de catálogo de verdade — documentado aqui, não
 * escondido atrás de um nome que sugira mais precisão do que existe. */
async function matchConvenio(clinicId: string, insuranceIdentified: string | null): Promise<{ identified: string | null; recognizedAsKnown: boolean }> {
  if (!insuranceIdentified?.trim()) return { identified: null, recognizedAsKnown: false };

  const entries = await prisma.clinicKnowledgeEntry.findMany({
    where: { clinicId, category: "CONVENIOS", active: true },
    select: { title: true, content: true },
  });

  const recognizedAsKnown = entries.some(
    (entry) =>
      levenshteinSimilarity(insuranceIdentified, entry.title) >= MATCH_THRESHOLD ||
      entry.content.toLowerCase().includes(insuranceIdentified.trim().toLowerCase())
  );

  return { identified: insuranceIdentified.trim(), recognizedAsKnown };
}

/** Heurística determinística (sem pedir auto-avaliação ao modelo, mantém o Zod
 * schema da Etapa 2 só com o que foi pedido): combina proporção de campos
 * extraídos não-vazios + tamanho do texto bruto da OCR (scan ruim tende a
 * produzir texto muito curto ou vazio). */
function computeLegibilityScore(extracted: ExtractedDocument, rawOcrTextLength: number): number {
  const fields = [extracted.insuranceIdentified, extracted.issuingDoctor, extracted.issueDate];
  const nonEmptyCount = fields.filter(Boolean).length + (extracted.proceduresFound.length > 0 ? 1 : 0);
  const completenessRatio = nonEmptyCount / 4;

  const lengthScore = rawOcrTextLength >= 40 ? 1 : rawOcrTextLength / 40;

  return Math.round(((completenessRatio + lengthScore) / 2) * 30);
}

export async function validateExtractedDocument(
  clinicId: string,
  extracted: ExtractedDocument,
  rawOcrTextLength: number
): Promise<DocumentValidationResult> {
  const clinicProcedures = await prisma.clinicProcedure.findMany({
    where: { clinicId },
    include: { procedure: { select: { name: true } } },
  });
  const catalog = clinicProcedures.map((cp) => ({ clinicProcedureId: cp.id, procedureName: cp.procedure.name }));

  const procedureMatches = matchProceduresAgainstCatalog(extracted.proceduresFound, catalog);
  const convenioMatch = await matchConvenio(clinicId, extracted.insuranceIdentified);

  const matchedCount = procedureMatches.filter((m) => m.matched).length;
  const catalogMatchScore =
    extracted.proceduresFound.length === 0 ? 0 : Math.round((matchedCount / extracted.proceduresFound.length) * 40);

  // Sem convênio identificado: neutro (nem penaliza, nem credita). Identificado e
  // reconhecido: pontuação cheia. Identificado mas não reconhecido: zero — pode ser
  // convênio que a clínica não aceita, ou só não cadastrado ainda (ambíguo de propósito,
  // vira "Revisão Necessária" em vez de rejeitar automaticamente).
  const convenioScore = convenioMatch.identified === null ? 15 : convenioMatch.recognizedAsKnown ? 30 : 0;

  const legibilityScore = computeLegibilityScore(extracted, rawOcrTextLength);

  const total = Math.min(100, catalogMatchScore + convenioScore + legibilityScore);

  return {
    procedureMatches,
    convenioMatch,
    confidence: { catalogMatchScore, convenioScore, legibilityScore, total, tier: tierFor(total) },
  };
}
