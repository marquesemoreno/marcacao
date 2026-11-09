/** BI da clínica — aba Faturamento (09/11/2026). Regras puras e testadas:
 * - comparação com o período anterior sempre pela média por DIA ÚTIL (seg–sex, sem feriado
 *   nacional), nunca pelo total bruto;
 * - convênios com valor por guia atípico são sinalizados (não escondidos);
 * - composição do total explícita. Hipótese A CONFIRMAR com a Santa Clara (dados de out/2026):
 *   o valor da guia (CPS1) já inclui a internação (84% das internações casam com uma guia de
 *   mesma data e valor) e o recibo é o pagamento de guia particular (100% ligados a CPS1).
 *   Então total = guias; internação e recibo aparecem como detalhe, sem somar de novo. */
import { isNationalHolidayYMD } from "@/lib/holidays";

const DAY = 86_400_000;
const parse = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function businessDays(inicio: string, fim: string): number {
  let n = 0;
  for (let t = parse(inicio).getTime(); t <= parse(fim).getTime(); t += DAY) {
    const d = new Date(t);
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (isNationalHolidayYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())) continue;
    n++;
  }
  return n;
}

const isFullMonth = (inicio: string, fim: string) => {
  const a = parse(inicio);
  const b = parse(fim);
  return a.getUTCDate() === 1 && new Date(b.getTime() + DAY).getUTCDate() === 1 && a.getUTCMonth() === b.getUTCMonth();
};

/** Mês fechado → mês anterior inteiro; senão a mesma quantidade de dias logo antes. */
export function previousPeriod(inicio: string, fim: string): { inicio: string; fim: string } {
  if (isFullMonth(inicio, fim)) {
    const a = parse(inicio);
    const prevStart = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - 1, 1, 12));
    const prevEnd = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 0, 12));
    return { inicio: fmt(prevStart), fim: fmt(prevEnd) };
  }
  const len = Math.round((parse(fim).getTime() - parse(inicio).getTime()) / DAY) + 1;
  return { inicio: fmt(new Date(parse(inicio).getTime() - len * DAY)), fim: fmt(new Date(parse(inicio).getTime() - DAY)) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function compareByBusinessDay(cur: { total: number; days: number }, prev: { total: number; days: number }) {
  const perDay = cur.days > 0 ? round2(cur.total / cur.days) : null;
  const prevPerDay = prev.days > 0 ? round2(prev.total / prev.days) : null;
  const changePct = perDay !== null && prevPerDay ? round1(((perDay - prevPerDay) / prevPerDay) * 100) : null;
  return { perDay, prevPerDay, changePct };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type AtypicalReason = "valor_repetido" | "mediana_baixa" | "guias_zeradas";
export type AtypicalConvenio = { convenio: string; guias: number; median: number | null; zeroCount: number; reasons: AtypicalReason[] };

/** Sinais (com pelo menos 5 guias no convênio):
 * - valor_repetido: ≥ 90% das guias com valor > 0 têm exatamente o mesmo valor (n ≥ 10) — típico de
 *   valor provisório (ex.: SUS a R$ 10);
 * - mediana_baixa: mediana por guia < 20% da mediana das medianas dos convênios;
 * - guias_zeradas: ≥ 10% das guias com valor 0. */
export function flagAtypicalConvenios(guias: { conv: string; v: number }[]): AtypicalConvenio[] {
  const by = new Map<string, number[]>();
  for (const g of guias) by.set(g.conv, [...(by.get(g.conv) ?? []), g.v]);
  const stats = [...by.entries()]
    .filter(([, vs]) => vs.length >= 5)
    .map(([convenio, vs]) => {
      const positive = vs.filter((v) => v > 0);
      return { convenio, vs, positive, med: median(positive) };
    });
  const ref = median(stats.map((s) => s.med).filter((m): m is number => m !== null));
  const out: AtypicalConvenio[] = [];
  for (const s of stats) {
    const reasons: AtypicalReason[] = [];
    if (s.positive.length >= 10) {
      const counts = new Map<number, number>();
      for (const v of s.positive) counts.set(v, (counts.get(v) ?? 0) + 1);
      if (Math.max(...counts.values()) / s.positive.length >= 0.9) reasons.push("valor_repetido");
    }
    if (ref && s.med !== null && s.med < ref * 0.2) reasons.push("mediana_baixa");
    const zeroCount = s.vs.length - s.positive.length;
    if (zeroCount / s.vs.length >= 0.1) reasons.push("guias_zeradas");
    if (reasons.length) out.push({ convenio: s.convenio, guias: s.vs.length, median: s.med, zeroCount, reasons });
  }
  return out;
}

export const ATYPICAL_LABEL: Record<AtypicalReason, string> = {
  valor_repetido: "quase todas as guias com o mesmo valor",
  mediana_baixa: "valor por guia muito abaixo dos outros convênios",
  guias_zeradas: "guias com valor zero",
};

export type BillingInput = {
  guias: { qtd: number; valor: number; zeradas: number };
  internacoes: { qtd: number; valor: number; valorCasado: number; qtdCasada: number };
  recibos: { qtd: number; valor: number; valorComGuia: number };
};

/** Total e o que entra nele, com a regra em texto para a tela. */
export function composeBilling(b: BillingInput) {
  const internacaoForaDasGuias = round2(b.internacoes.valor - b.internacoes.valorCasado);
  const reciboForaDasGuias = round2(b.recibos.valor - b.recibos.valorComGuia);
  return {
    total: round2(b.guias.valor),
    internacaoForaDasGuias,
    reciboForaDasGuias,
    toConfirm: true,
    rules: [
      {
        key: "total",
        label: "Faturado (guias)",
        rule: "Soma do valor de todas as guias do período (ambulatório e internação), particular e convênio. Guias com valor zero contam na quantidade, não no valor.",
      },
      {
        key: "internacao",
        label: "Internações",
        rule: "Detalhe — já estão dentro do total das guias (84% casam com uma guia de mesma data e valor). Não somam de novo. A parte sem guia aparece como “fora das guias”.",
      },
      {
        key: "recibos",
        label: "Particular recebido (recibos)",
        rule: "Pagamento de guias particulares — mostra o que já entrou no caixa. Não soma ao faturado.",
      },
    ],
  };
}

export type GuiaRow = [string, string, number];

/** Quantidade, valor, zeradas e ranking por convênio (com mediana por guia). */
export function summarizeGuias(guias: GuiaRow[], nomes: Record<string, string>) {
  const by = new Map<string, number[]>();
  let valor = 0;
  let zeradas = 0;
  for (const [, conv, v] of guias) {
    valor += v;
    if (v <= 0) zeradas++;
    by.set(conv, [...(by.get(conv) ?? []), v]);
  }
  const porConvenio = [...by.entries()]
    .map(([id, vs]) => ({
      id,
      convenio: nomes[id] || `Convênio ${id}`,
      qtd: vs.length,
      valor: round2(vs.reduce((a, b) => a + b, 0)),
      mediana: median(vs.filter((v) => v > 0)),
    }))
    .sort((a, b) => b.valor - a.valor);
  return { qtd: guias.length, valor: round2(valor), zeradas, porConvenio };
}

/** Meses AAAAMM → valor por dia útil; o mês de `hoje` conta só até hoje e fica marcado parcial. */
export function trendPerBusinessDay(rows: { mes: string; qtd: number; valor: number }[], hoje: string) {
  return rows.map((r) => {
    const mes = `${r.mes.slice(0, 4)}-${r.mes.slice(4, 6)}`;
    const inicio = `${mes}-01`;
    const a = parse(inicio);
    const lastDay = fmt(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0, 12)));
    const partial = hoje >= inicio && hoje < lastDay;
    const dias = businessDays(inicio, partial ? hoje : lastDay);
    return { mes, qtd: r.qtd, valor: r.valor, dias, porDia: dias > 0 ? round2(r.valor / dias) : null, partial };
  });
}
