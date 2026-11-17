/** Freio simples em memória (por instância da Vercel): segura abuso casual de rotas sem login.
 * Não substitui um limite persistente — cada instância conta sozinha. */
export function createMemoryRateLimit(max: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, number[]>();
  return {
    /** true = passou do limite (e não conta esta tentativa). */
    limited(key: string | null, now = Date.now()): boolean {
      if (!key) return false;
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return true;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) hits.clear();
      return false;
    },
    reset() {
      hits.clear();
    },
  };
}
