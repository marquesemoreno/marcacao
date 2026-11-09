/** Peças comuns das abas de BI do Relatório. */
export const biCard = "glass-surface p-5";
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "202610" ou "2026-10" → "out/26" */
export const monthLabel = (ym: string) => {
  const d = ym.replace("-", "");
  return `${MONTHS[Number(d.slice(4, 6)) - 1]}/${d.slice(2, 4)}`;
};
export const brDate = (ymd: string | null) => (ymd ? ymd.slice(0, 10).split("-").reverse().join("/") : "—");

export function lastMonths(n: number) {
  const now = new Date(Date.now() - 3 * 3600_000);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
}

/** Seletor de mês (GET) que mantém a aba. */
export function MonthPicker({ aba, month, count = 13 }: { aba: string; month: string; count?: number }) {
  return (
    <form action="/clinic/relatorio" className="flex items-end gap-2">
      <input type="hidden" name="aba" value={aba} />
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
        Mês
        <select
          name="mes"
          defaultValue={month}
          className="mt-1 block h-9 w-36 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {lastMonths(count).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="h-9 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
        Ver
      </button>
    </form>
  );
}

/** Ponte sem o endpoint (404/501) ou fora do ar. */
export function BridgeProblem({ title, reason }: { title: string; reason: "unavailable" | "error" }) {
  return (
    <section className={biCard}>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {reason === "unavailable"
          ? "O sistema da clínica ainda não está conectado a esta análise (a ponte precisa ser atualizada)."
          : "Não consegui falar com o sistema da clínica agora. Tente de novo em instantes."}
      </p>
    </section>
  );
}
