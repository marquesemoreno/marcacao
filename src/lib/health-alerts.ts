/** Alertas de saúde (cron /api/cron/health-check, a cada 15 min): WhatsApp de cada
 * clínica, bridges do Firebird e token do Instagram. Só alerta na 2ª falha seguida
 * (~30 min) pra não disparar por instabilidade de segundos, e avisa quando volta. */
export type HealthState = "ok" | "suspect" | "down";

export function nextHealthState(
  prev: HealthState | undefined,
  healthy: boolean,
): { state: HealthState; alert: "down" | "recovered" | null } {
  if (healthy) return { state: "ok", alert: prev === "down" ? "recovered" : null };
  if (prev === "down") return { state: "down", alert: null };
  if (prev === "suspect") return { state: "down", alert: "down" };
  return { state: "suspect", alert: null };
}

/** O computador da clínica (onde roda o bridge) fica desligado à noite e no domingo —
 * fora disso o 530/502 é esperado. Seg–sex 08–18h, sáb 08–12h (horário de Brasília). */
export function isBridgeCheckWindow(now = new Date()): boolean {
  const brt = new Date(now.getTime() - 3 * 3600_000);
  const day = brt.getUTCDay();
  const hour = brt.getUTCHours();
  if (day === 0) return false;
  if (day === 6) return hour >= 8 && hour < 12;
  return hour >= 8 && hour < 18;
}
