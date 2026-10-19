/** Carga do CRM em quadro. As conversas ativas são poucas (~110, ~240 KB) e vêm a cada
 * atualização; as finalizadas são milhares (~1.600, ~4 MB, ~6 s no banco) e só mudam quando
 * alguém finaliza/reabre — por isso ficam em cache e recarregam de tempos em tempos. */
export const FINALIZED_REFRESH_MS = 5 * 60_000;

export function shouldRefreshFinalized(input: {
  lastLoadedAt: number | null;
  /** Busca + clínica com que a lista em cache foi carregada, e a atual. */
  lastKey: string | null;
  key: string;
  /** Finalizou ou reabriu um card agora. */
  force: boolean;
  now: number;
}): boolean {
  if (input.force || input.lastLoadedAt === null) return true;
  if (input.lastKey !== input.key) return true;
  return input.now - input.lastLoadedAt >= FINALIZED_REFRESH_MS;
}
