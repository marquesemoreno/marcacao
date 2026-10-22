/** Destinatário das telas de teste da API oficial: aceita número brasileiro sem o 55
 * (10–11 dígitos com DDD) e completa o código do país — sem isso "77 9…" ia como DDI 77
 * (Cazaquistão) e a Meta recusava (131026). Número de 11 dígitos começando com 1 é dos EUA. */
export function normalizeTestRecipient(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if ((d.length === 10 || d.length === 11) && !(d.length === 11 && d.startsWith("1"))) return `55${d}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}
