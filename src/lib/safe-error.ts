/** Resumo de um erro que pode ir pro log sem levar dado de paciente (LGPD).
 *
 * Passar o objeto de erro inteiro pro `console.error` grava a mensagem completa e a pilha.
 * Erro de validação do Prisma traz os argumentos da consulta (nome, telefone, texto da
 * mensagem) nas linhas depois da primeira, e `error.message` sozinho tem o mesmo problema.
 * Aqui fica só o código (P2002, ECONNRESET…) e a primeira linha, cortada, com sequências
 * longas de dígitos mascaradas. O erro completo continua indo pro Sentry quando é lançado. */
export function errorSummary(error: unknown): string {
  const rec = error && typeof error === "object" ? (error as { message?: unknown; code?: unknown }) : null;
  const raw = rec ? (typeof rec.message === "string" ? rec.message : "") : typeof error === "string" ? error : "";
  const firstLine = raw.split("\n")[0].trim();
  if (!firstLine) return "erro desconhecido";
  const masked = firstLine.replace(/\d[\d.\-\s]{6,}\d/g, "[número]");
  const code = typeof rec?.code === "string" && rec.code ? `${rec.code} ` : "";
  return `${code}${masked}`.slice(0, 300);
}
