/** Regras do quadro do CRM (/clinic/crm) — coluna de cada card, filtros rápidos, alerta
 * do card, valor da coluna e ordem. Puro (crítica + pedido de 15/10/2026). */
import { NO_RESPONSE_TAG, NON_PATIENT_TAG } from "./conversation-tags";

export type KanbanStage = "novos" | "triagem" | "orcamento" | "agendado" | "finalizado";
export type CrmQuickFilter = "todos" | "ativos" | "aguardando" | "frios";

export type CrmCardInput = {
  isResolved: boolean;
  funnelStage: Exclude<KanbanStage, "finalizado">;
  /** Minutos que o paciente espera resposta (null = não está esperando). */
  waitingMinutes: number | null;
  lastMessageAt?: string;
  tags: string[];
  estimatedValueNumber?: number;
};

const WAITING_ALERT_MIN = 15;
const COLD_DAYS = 30;

export function kanbanStageOf(c: Pick<CrmCardInput, "isResolved" | "funnelStage">): KanbanStage {
  return c.isResolved ? "finalizado" : c.funnelStage;
}

function bahiaDay(d: Date): string {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function matchesQuickFilter(c: CrmCardInput, filter: CrmQuickFilter, now: Date): boolean {
  if (filter === "todos") return true;
  if (filter === "ativos") return !c.isResolved;
  if (filter === "aguardando") return !c.isResolved && (c.waitingMinutes ?? 0) > WAITING_ALERT_MIN;
  if (!c.lastMessageAt || c.isResolved) return false;
  return now.getTime() - new Date(c.lastMessageAt).getTime() > COLD_DAYS * 86_400_000;
}

/** Destaque do card: tag "Sem retorno" (paciente não respondeu) ou ativo sem nenhuma
 * mensagem hoje. */
export function crmAlert(c: CrmCardInput, now: Date): "sem_retorno" | "sem_interacao_hoje" | null {
  if (c.isResolved) return null;
  if (c.tags.includes(NO_RESPONSE_TAG)) return "sem_retorno";
  if (c.lastMessageAt && bahiaDay(new Date(c.lastMessageAt)) !== bahiaDay(now)) return "sem_interacao_hoje";
  return null;
}

/** Valor estimado da coluna: o estimado de cada card; quem não tem usa o ticket médio. */
export function columnValue(cards: CrmCardInput[], ticket: number | null): { total: number; fromTicket: number } {
  let total = 0;
  let fromTicket = 0;
  for (const c of cards) {
    if (c.estimatedValueNumber && c.estimatedValueNumber > 0) total += c.estimatedValueNumber;
    else if (ticket) {
      total += ticket;
      fromTicket++;
    }
  }
  return { total, fromTicket };
}

export function sortColumn<T extends CrmCardInput>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const wa = a.waitingMinutes ?? -1;
    const wb = b.waitingMinutes ?? -1;
    if (wa !== wb) return wb - wa;
    return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
  });
}

/** Tags que o sistema põe sozinho (status, origem, urgência) — não viram chip de filtro. */
const AUTO_TAG_PREFIXES = ["⏳", "✅", "❌", "🔁", "⚠️", "🚨", "📢", "💰", "🎯", "🤝", "⚡", "🔬", "🚫"];
const isAutoTag = (t: string) => AUTO_TAG_PREFIXES.some((p) => t.startsWith(p));

/** Chips de filtro do CRM: tags da clínica nos cards, mais usadas primeiro. */
export function tagCounts(cards: Pick<CrmCardInput, "tags">[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of cards) for (const t of new Set(c.tags)) if (!isAutoTag(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"));
}

/** Sem tag selecionada passa tudo; com seleção, basta ter UMA das tags escolhidas. */
export function matchesTags(c: Pick<CrmCardInput, "tags">, selected: string[]): boolean {
  return selected.length === 0 || c.tags.some((t) => selected.includes(t));
}

/** Conversa marcada como "não é paciente" (parceiro, propaganda, feedback). */
export function isNonPatient(tags: string[]): boolean {
  return tags.includes(NON_PATIENT_TAG);
}
