/**
 * Lógica pura de fuzzy-matching (Levenshtein) + classificação de confiança —
 * separada de document-validator.ts (que tem `server-only`/Prisma) só pra dar
 * pra testar direto, mesmo padrão deste projeto de extrair a parte pura de um
 * módulo server-only pra um arquivo testável (ver appointment-reply.ts vs
 * appointment-reply-ai.ts).
 */

export type ConfidenceTier = "ALTA" | "REVISAO" | "BAIXA";

/** Distância de Levenshtein clássica (programação dinâmica O(n*m)) — strings
 * curtas (nome de procedimento), custo desprezível, sem necessidade de lib
 * (não existe lib de similaridade instalada no projeto). */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[rows - 1][cols - 1];
}

/** 0-1, normalizado pelo comprimento da maior string — 1 = idêntico, 0 = nada em comum. */
export function levenshteinSimilarity(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left && !right) return 1;
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(left, right) / maxLength;
}

export function tierFor(total: number): ConfidenceTier {
  if (total >= 85) return "ALTA";
  if (total >= 60) return "REVISAO";
  return "BAIXA";
}
