/** Campanhas no CRM e no relatório (pedido de 19/10/2026, referência: Kommo da Acurae) —
 * "campanha" = canal de aquisição + detalhe (título do anúncio do Meta, utm_campaign ou o
 * código #site-/#gads-… do link rastreado, ver acquisition.ts). Puro, testável sem banco. */
import { hasOutcome } from "./report-metrics";

export const NO_CAMPAIGN = "Sem origem identificada";

const UNIDENTIFIED = new Set(["Não identificado", "Indicação / Direto"]);

export function campaignLabel(channel: string | null | undefined, detail: string | null | undefined): string {
  if (!channel || UNIDENTIFIED.has(channel)) return detail ? `${channel ?? "Origem"} · ${detail}` : NO_CAMPAIGN;
  return detail ? `${channel} · ${detail}` : channel;
}

type WithAcquisition = { acquisitionChannel?: string | null; acquisitionDetail?: string | null };

/** Colunas do CRM "Por campanha": mais pacientes primeiro, "sem origem" sempre por último. */
export function groupByCampaign<T extends WithAcquisition>(items: T[]): { label: string; channel: string | null; items: T[] }[] {
  const map = new Map<string, { label: string; channel: string | null; items: T[] }>();
  for (const it of items) {
    const label = campaignLabel(it.acquisitionChannel, it.acquisitionDetail);
    const col = map.get(label) ?? { label, channel: label === NO_CAMPAIGN ? null : it.acquisitionChannel ?? null, items: [] };
    col.items.push(it);
    map.set(label, col);
  }
  return [...map.values()].sort((a, b) => {
    if (a.label === NO_CAMPAIGN) return 1;
    if (b.label === NO_CAMPAIGN) return -1;
    return b.items.length - a.items.length || a.label.localeCompare(b.label, "pt-BR");
  });
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type CampaignReportRow = {
  label: string;
  channel: string | null;
  leads: number;
  scheduled: number;
  conversionRate: number | null;
  revenue: number | null;
  spend: number | null;
  costPerLead: number | null;
  costPerScheduled: number | null;
  roi: number | null;
};

/** Desempenho por campanha. Conversão = agendou / conversas com desfecho (mesma base do
 * resto do relatório). Receita = agendaram × ticket médio (estimativa). Investimento vem do
 * que a clínica informou pro mês (spendByLabel); sem ele, custo e retorno ficam null. */
export function computeCampaignReport(
  conversations: (WithAcquisition & { status: string; resolutionReason: string | null })[],
  ticket: number | null,
  spendByLabel: Record<string, number>
): CampaignReportRow[] {
  return groupByCampaign(conversations).map(({ label, channel, items }) => {
    const leads = items.length;
    const withOutcome = items.filter(hasOutcome).length;
    const scheduled = items.filter((c) => c.resolutionReason === "AGENDAMENTO_CONCLUIDO").length;
    const revenue = ticket !== null ? scheduled * ticket : null;
    const spend = spendByLabel[label] ?? null;
    return {
      label,
      channel,
      leads,
      scheduled,
      conversionRate: withOutcome > 0 ? round1((scheduled / withOutcome) * 100) : null,
      revenue,
      spend,
      costPerLead: spend !== null && leads > 0 ? round2(spend / leads) : null,
      costPerScheduled: spend !== null && scheduled > 0 ? round2(spend / scheduled) : null,
      roi: spend !== null && spend > 0 && revenue !== null ? round1(((revenue - spend) / spend) * 100) : null,
    };
  });
}
