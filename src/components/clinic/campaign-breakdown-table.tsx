"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCampaignSpend } from "@/actions/clinic";
import { formatCurrency } from "@/lib/format";
import type { CampaignReportRow } from "@/lib/crm-campaigns";

const pctBR = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Relatório "Por campanha": leads, agendamentos, conversão, receita estimada e — com o
 * investimento do mês informado aqui — custo por lead, por agendamento e retorno. */
export function CampaignBreakdownTable({ rows, month }: { rows: CampaignReportRow[]; month: string | null }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>({});

  function save(label: string) {
    if (!month) return;
    const raw = (draft[label] ?? "").replace(/\./g, "").replace(",", ".").trim();
    const amount = raw === "" ? null : Number(raw);
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
      toast.error("Valor inválido.");
      return;
    }
    startTransition(async () => {
      const r = await saveCampaignSpend({ campaign: label, month, amount });
      if (r.success) toast.success(amount ? "Investimento salvo." : "Investimento removido.");
      else toast.error(r.error);
    });
  }

  if (rows.length === 0) return <p className="p-5 text-xs text-slate-500 dark:text-slate-400">Nenhuma conversa no período.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400">
            <th className="py-2 pl-5 pr-3 text-left font-medium">Campanha</th>
            <th className="px-3 text-right font-medium">Leads</th>
            <th className="px-3 text-right font-medium">Agendaram</th>
            <th className="px-3 text-right font-medium">Conversão</th>
            <th className="px-3 text-right font-medium">Receita estimada</th>
            {month && (
              <>
                <th className="px-3 text-right font-medium">Investimento no mês</th>
                <th className="px-3 text-right font-medium">Custo por lead</th>
                <th className="px-3 text-right font-medium">Custo por agendamento</th>
                <th className="pr-5 pl-3 text-right font-medium">Retorno</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-2 pl-5 pr-3 font-medium">{r.label}</td>
              <td className="px-3 text-right tabular-nums">{r.leads}</td>
              <td className="px-3 text-right tabular-nums">{r.scheduled}</td>
              <td className="px-3 text-right tabular-nums">{r.conversionRate !== null ? pctBR(r.conversionRate) : "—"}</td>
              <td className="px-3 text-right tabular-nums">{r.revenue !== null ? formatCurrency(r.revenue) : "—"}</td>
              {month && (
                <>
                  <td className="px-3 text-right">
                    <input
                      inputMode="decimal"
                      aria-label={`Investimento em ${r.label}`}
                      placeholder="R$ 0"
                      defaultValue={r.spend !== null ? String(r.spend).replace(".", ",") : ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.label]: e.target.value }))}
                      onBlur={() => draft[r.label] !== undefined && save(r.label)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      disabled={pending}
                      className="h-8 w-28 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-3 text-right tabular-nums">{r.costPerLead !== null ? formatCurrency(r.costPerLead) : "—"}</td>
                  <td className="px-3 text-right tabular-nums">{r.costPerScheduled !== null ? formatCurrency(r.costPerScheduled) : "—"}</td>
                  <td
                    className={`pr-5 pl-3 text-right font-semibold tabular-nums ${
                      r.roi === null ? "" : r.roi >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    {r.roi !== null ? `${r.roi >= 0 ? "+" : ""}${pctBR(r.roi)}` : "—"}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
