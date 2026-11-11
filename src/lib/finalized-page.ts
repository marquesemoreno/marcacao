/** Paginação das conversas finalizadas (aba "Finalizadas" do Chat e coluna "Finalizado" do
 * CRM). Elas só crescem — eram ~1.600 por clínica (~4 MB, ~6 s no banco) e vinham todas de
 * uma vez. Agora vêm as mais recentes, e o "Carregar mais" pede um limite maior. */
export const FINALIZED_PAGE_SIZE = 200;
/** Teto do que uma tela carrega; além disso, usar a busca. */
export const FINALIZED_MAX = 3000;

/** Quantas finalizadas buscar. O limite vem do navegador, então é saneado aqui. */
export function finalizedTake(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit < 1) return FINALIZED_PAGE_SIZE;
  return Math.min(Math.floor(limit), FINALIZED_MAX);
}

/** A lista veio cheia até o limite: pode haver mais no banco. */
export function hasMoreFinalized(loaded: number, limit: number): boolean {
  return loaded >= limit && limit < FINALIZED_MAX;
}

export function nextFinalizedLimit(current: number): number {
  return Math.min(current + FINALIZED_PAGE_SIZE, FINALIZED_MAX);
}
