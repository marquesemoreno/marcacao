/** Ordem da fila do Chat (crítica de design, out/2026): o produto existe pra nenhum
 * paciente ficar sem resposta, então quem espera resposta há mais tempo sobe — não a
 * última mensagem. Urgência clínica e remarcação pendente continuam no topo (são alertas
 * de ação). Espera de mais de 48 h é conversa esquecida: vem depois de quem espera hoje
 * (decisão do usuário — senão o passivo de 30 dias soterrava quem acabou de escrever),
 * na ordem original. Quem não está esperando vem por último: sem dono, fixadas e a ordem
 * original (por última mensagem, que já vem do banco — o sort é estável). */

/** Acima disso a espera conta como "esquecida" (vai depois das esperas recentes). */
export const STALE_WAIT_MINUTES = 48 * 60;

export type QueueSortable = {
  queueState: string;
  pinned: boolean;
  sla: { shouldDisplay: boolean; realWaitingMinutes: number };
};

const TOP: Record<string, number> = { URGENCIA_CLINICA: 0, REMARCACAO_PENDENTE: 1 };

function tier(r: QueueSortable): number {
  if (r.queueState in TOP) return TOP[r.queueState];
  if (r.sla.shouldDisplay) return r.sla.realWaitingMinutes > STALE_WAIT_MINUTES ? 3 : 2;
  if (r.queueState === "SEM_DONO") return 4;
  return 5;
}

export function compareQueue(a: QueueSortable, b: QueueSortable): number {
  const t = tier(a) - tier(b);
  if (t !== 0) return t;
  if (tier(a) === 2) return b.sla.realWaitingMinutes - a.sla.realWaitingMinutes;
  return Number(b.pinned) - Number(a.pinned);
}

export type QueueGroup = "prioridade" | "aguardando" | "esquecidas" | "resto";

/** Grupo da linha na fila — vira divisória na lista ("Esquecidas há mais de 48 h" etc.),
 * pra o passivo antigo não ficar invisível no meio de quem espera hoje. */
export function queueGroup(r: QueueSortable): QueueGroup {
  const t = tier(r);
  return t <= 1 ? "prioridade" : t === 2 ? "aguardando" : t === 3 ? "esquecidas" : "resto";
}

export const QUEUE_GROUP_LABEL: Record<QueueGroup, string> = {
  prioridade: "Prioridade",
  aguardando: "Aguardando resposta",
  esquecidas: "Esquecidas há mais de 48 h",
  resto: "Sem resposta pendente",
};
