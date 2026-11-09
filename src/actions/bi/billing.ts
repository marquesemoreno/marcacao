"use server";

import { unstable_cache } from "next/cache";
import { requireClinicManager } from "@/lib/session";
import { recordAudit } from "@/lib/audit-server";
import { fetchBridgeBiBilling } from "@/lib/hospital-bridge";
import {
  ATYPICAL_LABEL,
  businessDays,
  compareByBusinessDay,
  composeBilling,
  flagAtypicalConvenios,
  summarizeGuias,
  trendPerBusinessDay,
} from "@/lib/bi/billing";

class BridgeUnavailable extends Error {
  constructor(readonly reason: "unavailable" | "error") {
    super(reason);
  }
}

const todaySP = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { inicio: `${month}-01`, fim: `${month}-${String(last).padStart(2, "0")}` };
}
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

async function compute(clinicId: string, month: string, today: string) {
  const full = monthBounds(month);
  // Mês corrente: só até hoje; comparação com o mês anterior inteiro, sempre por dia útil.
  const fim = today < full.fim ? today : full.fim;
  const prev = monthBounds(shiftMonth(month, -1));
  const [cur, before] = await Promise.all([
    fetchBridgeBiBilling(clinicId, full.inicio, fim, `${shiftMonth(month, -12)}-01`),
    fetchBridgeBiBilling(clinicId, prev.inicio, prev.fim, prev.inicio),
  ]);
  // Falha não entra no cache: lança e quem chama converte.
  if (!cur.ok) throw new BridgeUnavailable(cur.reason);
  const d = cur.data;
  const guias = summarizeGuias(d.guias, d.convenios);
  const composition = composeBilling({
    guias: { qtd: guias.qtd, valor: guias.valor, zeradas: guias.zeradas },
    internacoes: d.internacoes,
    recibos: d.recibos,
  });
  const days = businessDays(full.inicio, fim);
  const prevTotal = before.ok ? summarizeGuias(before.data.guias, before.data.convenios).valor : null;
  const comparison =
    prevTotal === null
      ? null
      : { ...compareByBusinessDay({ total: guias.valor, days }, { total: prevTotal, days: businessDays(prev.inicio, prev.fim) }), prevTotal };
  const atypical = flagAtypicalConvenios(d.guias.map(([, conv, v]) => ({ conv, v }))).map((a) => ({
    ...a,
    nome: d.convenios[a.convenio] || `Convênio ${a.convenio}`,
    motivos: a.reasons.map((r) => ATYPICAL_LABEL[r]),
  }));
  return {
    ok: true as const,
    month,
    inicio: full.inicio,
    fim,
    partial: fim < full.fim,
    days,
    fonte: d.fonte,
    geradoEm: d.geradoEm,
    ultimaGuia: d.ultimaGuia,
    guias,
    composition,
    comparison,
    atypical,
    trend: trendPerBusinessDay(d.tendencia, today),
    medicos: d.medicos,
    coberturaMedico: guias.valor > 0 ? Math.round((d.valorComMedico / guias.valor) * 1000) / 10 : null,
    valorComMedico: d.valorComMedico,
    datasInvalidas: d.datasInvalidas,
    internacoes: d.internacoes,
    recibos: d.recibos,
  };
}

export type BiBillingView = Awaited<ReturnType<typeof compute>> | { ok: false; reason: "unavailable" | "error" };

/** BI › Faturamento. Só gestão; abertura registrada na auditoria; leitura da ponte em cache 3h. */
export async function getBiBilling(month: string): Promise<BiBillingView> {
  const { clinicId, userId } = await requireClinicManager();
  const today = todaySP();
  const safeMonth = /^\d{4}-\d{2}$/.test(month) && month <= today.slice(0, 7) ? month : today.slice(0, 7);
  let view: BiBillingView;
  try {
    view = await unstable_cache(compute, ["bi-billing", clinicId, safeMonth, today], { revalidate: 3 * 3600 })(clinicId, safeMonth, today);
  } catch (e) {
    view = { ok: false, reason: e instanceof BridgeUnavailable ? e.reason : "error" };
  }
  await recordAudit({ clinicId, userId, action: "bi.billing.view", entity: "Clinic", entityId: clinicId, before: null, after: { month: safeMonth } }).catch(() => {});
  return view;
}
