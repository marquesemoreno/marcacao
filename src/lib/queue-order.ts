/** Ordem da fila do Chat (crítica de design, out/2026): o produto existe pra nenhum
 * paciente ficar sem resposta, então quem espera resposta há mais tempo sobe — não a
 * última mensagem. Urgência clínica e remarcação pendente continuam no topo (são alertas
 * de ação). Quem não está esperando vem depois: sem dono, fixadas e a ordem original
 * (por última mensagem, que já vem do banco — o sort é estável). */

export type QueueSortable = {
  queueState: string;
  pinned: boolean;
  sla: { shouldDisplay: boolean; realWaitingMinutes: number };
};

const TOP: Record<string, number> = { URGENCIA_CLINICA: 0, REMARCACAO_PENDENTE: 1 };

function tier(r: QueueSortable): number {
  if (r.queueState in TOP) return TOP[r.queueState];
  if (r.sla.shouldDisplay) return 2;
  if (r.queueState === "SEM_DONO") return 3;
  return 4;
}

export function compareQueue(a: QueueSortable, b: QueueSortable): number {
  const t = tier(a) - tier(b);
  if (t !== 0) return t;
  if (tier(a) === 2) return b.sla.realWaitingMinutes - a.sla.realWaitingMinutes;
  return Number(b.pinned) - Number(a.pinned);
}
