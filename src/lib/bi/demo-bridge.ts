/** Modo demo da ponte (09/11/2026): a clínica de demonstração não tem sistema conectado, então
 * Faturamento, Financeiro e Estoque recebem números FICTÍCIOS daqui — no mesmo formato da ponte.
 * Determinístico (semente = data), para o vídeo mostrar o mesmo número toda vez. Puro. */
import { isNationalHolidayYMD } from "@/lib/holidays";
import type { BridgeBiBilling, BridgeFinanceSummary, BridgeStockSummary } from "@/lib/hospital-bridge";

const DAY = 86_400_000;
const parse = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONVENIOS: Record<string, string> = { "1": "PARTICULAR", "2": "UNIMED", "3": "BRADESCO SAÚDE", "4": "CASSI", "5": "SUS", "6": "SULAMÉRICA" };
/** [convênio, peso, valor base] — SUS a R$ 10 fixo e CASSI com guias zeradas, para a tela de atípicos. */
const MIX: [string, number, number][] = [
  ["1", 0.38, 260],
  ["2", 0.24, 190],
  ["3", 0.14, 170],
  ["4", 0.08, 150],
  ["5", 0.1, 10],
  ["6", 0.06, 180],
];
const DOCTORS = ["Dra. Lívia Andrade", "Dr. Henrique Matos", "Dra. Paula Siqueira"];

const isBusinessDay = (d: Date) =>
  d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !isNationalHolidayYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

/** Guias de um dia (vazio em fim de semana/feriado ou no futuro). */
function guiasDoDia(ymd: string, today: string): [string, string, number][] {
  const d = parse(ymd);
  if (ymd > today || !isBusinessDay(d)) return [];
  const r = rng(`guias:${ymd}`);
  const n = 26 + Math.floor(r() * 14);
  const out: [string, string, number][] = [];
  for (let i = 0; i < n; i++) {
    let x = r();
    let pick = MIX[0];
    for (const m of MIX) {
      if (x < m[1]) {
        pick = m;
        break;
      }
      x -= m[1];
    }
    const [conv, , base] = pick;
    let v = conv === "5" ? 10 : round2(base * (0.6 + r() * 1.2) + (r() < 0.06 ? 900 + r() * 1500 : 0));
    if (conv === "4" && r() < 0.15) v = 0;
    out.push([ymd, conv, v]);
  }
  return out;
}

function days(inicio: string, fim: string): string[] {
  const out: string[] = [];
  for (let t = parse(inicio).getTime(); t <= parse(fim).getTime(); t += DAY) out.push(fmt(new Date(t)));
  return out;
}

function billing(inicio: string, fim: string, desde: string, today: string): BridgeBiBilling {
  const guias = days(inicio, fim).flatMap((d) => guiasDoDia(d, today));
  const total = guias.reduce((s, g) => s + g[2], 0);
  const r = rng(`mes:${inicio}:${fim}`);
  const intValor = round2(total * (0.55 + r() * 0.1));
  const recibo = round2(guias.filter((g) => g[1] === "1").reduce((s, g) => s + g[2], 0) * 0.92);

  const meses = new Map<string, { qtd: number; valor: number }>();
  for (const d of days(desde, fim)) {
    const g = guiasDoDia(d, today);
    if (!g.length) continue;
    const k = d.slice(0, 7).replace("-", "");
    const m = meses.get(k) ?? { qtd: 0, valor: 0 };
    m.qtd += g.length;
    m.valor += g.reduce((s, x) => s + x[2], 0);
    meses.set(k, m);
  }
  // Mês sem nenhum dia útil ainda (ex.: começo de mês) aparece zerado em vez de sumir.
  for (let t = parse(`${desde.slice(0, 7)}-01`); fmt(t) <= fim; t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1, 12))) {
    const k = fmt(t).slice(0, 7).replace("-", "");
    if (!meses.has(k)) meses.set(k, { qtd: 0, valor: 0 });
  }
  const shares = [0.18, 0.13, 0.09];
  const medicos = DOCTORS.map((medico, i) => ({ medico, procedimentos: Math.round(guias.length * shares[i] * 1.2), total: round2(total * shares[i]) }));
  const ultima = [...guias].reverse()[0]?.[0] ?? null;

  return {
    fonte: "Sistema da clínica (DEMONSTRAÇÃO — números fictícios)",
    inicio,
    fim,
    geradoEm: new Date().toISOString(),
    ultimaGuia: ultima,
    convenios: CONVENIOS,
    guias: guias.map(([d, c, v]) => [d, c, v]),
    internacoes: { qtd: Math.round(guias.length * 0.2), valor: intValor, qtdCasada: Math.round(guias.length * 0.17), valorCasado: round2(intValor * 0.84) },
    recibos: { qtd: Math.round(guias.filter((g) => g[1] === "1").length * 0.85), valor: recibo, valorComGuia: round2(recibo * 0.99) },
    tendencia: [...meses.entries()].sort().map(([mes, m]) => ({ mes, qtd: m.qtd, valor: round2(m.valor) })),
    medicos,
    valorComMedico: round2(medicos.reduce((s, m) => s + m.total, 0)),
    datasInvalidas: 2,
  };
}

function finance(inicio: string, fim: string, today: string): BridgeFinanceSummary {
  const total = days(inicio, fim).flatMap((d) => guiasDoDia(d, today)).reduce((s, g) => s + g[2], 0);
  const r = rng(`fin:${inicio}`);
  const receber = round2(total * 0.82);
  const pagar = round2(total * (0.58 + r() * 0.08));
  let last = parse(today < fim ? today : fim);
  do last = new Date(last.getTime() - DAY);
  while (!isBusinessDay(last));
  return {
    inicio,
    fim,
    receber: { emitido: receber, titulos: 140 + Math.floor(r() * 40), baixado: round2(receber * 0.88), vencidoEmAberto: round2(receber * 0.07), titulosVencidos: 9 },
    pagar: { emitido: pagar, titulos: 60 + Math.floor(r() * 20), baixado: round2(pagar * 0.93), vencidoEmAberto: round2(pagar * 0.02), titulosVencidos: 2 },
    planoDeContas: [
      { tipo: "R", conta: "Convênios", total: round2(receber * 0.6) },
      { tipo: "R", conta: "Particular", total: round2(receber * 0.4) },
      { tipo: "D", conta: "Folha de pagamento", total: round2(pagar * 0.45) },
      { tipo: "D", conta: "Honorários médicos", total: round2(pagar * 0.25) },
      { tipo: "D", conta: "Materiais e medicamentos", total: round2(pagar * 0.15) },
      { tipo: "D", conta: "Aluguel e condomínio", total: round2(pagar * 0.1) },
      { tipo: "D", conta: "Energia, água e internet", total: round2(pagar * 0.05) },
    ],
    ultimaBaixa: fmt(last),
    ultimoMovimento: today < fim ? today : fim,
  };
}

function stock(today: string): BridgeStockSummary {
  const mes = (k: number) => {
    const t = parse(today);
    return fmt(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - k, 1, 12))).slice(0, 7).replace("-", "");
  };
  return {
    locais: [
      { local: "Almoxarifado central", produtosComSaldo: 214 },
      { local: "Centro cirúrgico", produtosComSaldo: 87 },
      { local: "Posto de enfermagem", produtosComSaldo: 46 },
    ],
    consumo: { qtd30: 3840, qtd90: 11260, produtos90: 162 },
    maisUsados30: [
      { produto: "Luva de procedimento M", qtd: 1200 },
      { produto: "Seringa 5 ml", qtd: 640 },
      { produto: "Gaze estéril 7,5 × 7,5", qtd: 520 },
      { produto: "Agulha 25 × 7", qtd: 480 },
      { produto: "Álcool 70% 1 L", qtd: 64 },
      { produto: "Lençol descartável", qtd: 310 },
    ],
    paradosSemSaida180: 23,
    comprasPorMes: [0, 1, 2].map((k) => ({ mes: mes(k), notas: 11 - k * 2, total: 18_400 - k * 2_100 })),
  };
}

/** Resposta fictícia para um caminho da ponte; null = caminho sem modo demo. */
export function demoBridgeResponse(path: string, today: string): unknown | null {
  const url = new URL(path, "http://demo.invalid");
  const q = (k: string) => url.searchParams.get(k) ?? "";
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (url.pathname === "/api/bi/faturamento" && ymd.test(q("inicio")) && ymd.test(q("fim")))
    return billing(q("inicio"), q("fim"), ymd.test(q("tendenciaDesde")) ? q("tendenciaDesde") : q("inicio"), today);
  if (url.pathname === "/api/financeiro/resumo" && ymd.test(q("inicio")) && ymd.test(q("fim"))) return finance(q("inicio"), q("fim"), today);
  if (url.pathname === "/api/estoque/resumo") return stock(today);
  return null;
}
